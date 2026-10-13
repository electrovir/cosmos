// cspell:words basemap colourspace mdir usgs magellan mozjpeg bitpix naxis mdis
import {awaitedForEach, createArray, getObjectTypedEntries, log} from '@augment-vir/common';
import {BodyId} from '@cosmos/frontend/src/data/celestial-body.js';
import {
    surfaceMapFileNames,
    surfaceMapSize,
    surfaceMapSmallSize,
    type SurfaceMapBodyId,
} from '@cosmos/frontend/src/data/surface-map/surface-map-files.js';
import {createRandom} from '@cosmos/frontend/src/physics/solar-wind-weather.js';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import sharp, {type Sharp} from 'sharp';
import {download, type DownloadSource} from './download.js';
import {createSurfaceMapOutputDirPath} from './file-paths.js';

/** Opens a public domain NASA or USGS map whose left edge is already 180°W. */
async function openMap(source: Readonly<DownloadSource>) {
    return sharp(await download(source), {
        limitInputPixels: false,
    });
}

/** Same as `openMap` but for a map whose left edge is 0°, which this moves to the middle. */
async function openMapStartingAtPrimeMeridian(source: Readonly<DownloadSource>) {
    return await centerPrimeMeridian(await openMap(source));
}

/** Moves the 0° longitude of a map whose left edge is 0° to the middle. */
async function centerPrimeMeridian(map: Sharp) {
    const {data, info} = await map
        .resize(surfaceMapSize.width, surfaceMapSize.height)
        .removeAlpha()
        .toColourspace('srgb')
        .raw()
        .toBuffer({
            resolveWithObject: true,
        });
    const rowLength = info.width * info.channels;
    const halfRowLength = rowLength / 2;
    const shifted = Buffer.concat(
        createArray(info.height, (row) => {
            const rowStart = row * rowLength;
            return Buffer.concat([
                data.subarray(rowStart + halfRowLength, rowStart + rowLength),
                data.subarray(rowStart, rowStart + halfRowLength),
            ]);
        }),
    );
    return sharp(shifted, {
        raw: {
            width: info.width,
            height: info.height,
            channels: info.channels,
        },
    });
}

/** Fills a map's black regions, which its spacecraft never saw, with the nearby seen colors. */
async function fillUnseen(map: Sharp) {
    const {data, info} = await map
        .resize(surfaceMapSize.width, surfaceMapSize.height)
        .removeAlpha()
        .toColourspace('srgb')
        .raw()
        .toBuffer({
            resolveWithObject: true,
        });
    const {width, height, channels} = info;
    /** JPEG-like noise keeps the unseen regions from being exactly 0. */
    const seenMask = Buffer.from(
        createArray(width * height, (pixel) => {
            return data
                .subarray(pixel * channels, (pixel + 1) * channels)
                .some((value) => value > 4)
                ? 255
                : 0;
        }),
    );
    const seenOnly = data.map((value, index) => {
        return seenMask[Math.floor(index / channels)] ? value : 0;
    });

    /**
     * Fills the unseen regions with the nearby seen colors, blurred out: the seen image and the
     * seen mask are blurred alike, and dividing them averages only the seen pixels. Done small, so
     * the blur reaches across a whole unseen hemisphere.
     */
    async function blurSmall(buffer: Readonly<Uint8Array>, bufferChannels: 1 | 3) {
        const blurred = sharp(buffer, {
            raw: {
                width,
                height,
                channels: bufferChannels,
            },
        })
            .resize(128, 64)
            .blur(12);
        /** Sharp writes one-channel raw input back out as three channels. */
        return await (bufferChannels === 1 ? blurred.extractChannel(0) : blurred).raw().toBuffer();
    }
    const [
        smallSeenOnly,
        smallSeenMask,
    ] = await Promise.all([
        blurSmall(seenOnly, 3),
        blurSmall(seenMask, 1),
    ]);
    const seenPixelCount = seenMask.filter((value) => value).length;
    const seenAverages = createArray(channels, (channel) => {
        return (
            seenOnly.reduce(
                (sum, value, index) => (index % channels === channel ? sum + value : sum),
                0,
            ) / seenPixelCount
        );
    });
    const smallFill = smallSeenOnly.map((value, index) => {
        const weight = smallSeenMask[Math.floor(index / channels)] ?? 0;
        const seenAverage = seenAverages[index % channels] ?? 0;
        /** Far from any photo the 8-bit blurs are too faint to divide cleanly. */
        const nearbyShare = Math.min(1, weight / 64);
        const nearbyValue = weight ? Math.min(255, (value * 255) / weight) : 0;
        return Math.round(nearbyValue * nearbyShare + seenAverage * (1 - nearbyShare));
    });
    const [
        fill,
        edgeBlend,
    ] = await Promise.all([
        sharp(smallFill, {
            raw: {
                width: 128,
                height: 64,
                channels: 3,
            },
        })
            .resize(width, height)
            .raw()
            .toBuffer(),
        /**
         * Softens the line where the photos end. Only the inner half of the blur keeps any photo,
         * so the bright smear along the photos' edge fades out too.
         */
        sharp(seenMask, {
            raw: {
                width,
                height,
                channels: 1,
            },
        })
            .blur(48)
            .extractChannel(0)
            .raw()
            .toBuffer(),
    ]);
    const filled = data.map((value, index) => {
        const pixel = Math.floor(index / channels);
        const fillValue = fill[index] ?? 0;
        const seenShare = Math.max(0, ((edgeBlend[pixel] ?? 0) / 255 - 0.5) * 2);
        const sharpValue = seenMask[pixel] ? value : fillValue;
        return Math.round(sharpValue * seenShare + fillValue * (1 - seenShare));
    });
    return sharp(filled, {
        raw: {
            width,
            height,
            channels,
        },
    });
}

/** Colors a black and white map by scaling each of its red, green, and blue channels by `tint`. */
async function tintGrayMap({
    map,
    tint,
}: Readonly<{
    map: Sharp;
    tint: Readonly<
        [
            number,
            number,
            number,
        ]
    >;
}>) {
    const {data, info} = await map
        .resize(surfaceMapSize.width, surfaceMapSize.height)
        .removeAlpha()
        .toColourspace('b-w')
        .extractChannel(0)
        .raw()
        .toBuffer({
            resolveWithObject: true,
        });
    /** `linear` runs before any colorspace change, so the gray is made three channels first. */
    const color = await sharp(data, {
        raw: {
            width: info.width,
            height: info.height,
            channels: 1,
        },
    })
        .toColourspace('srgb')
        .raw()
        .toBuffer({
            resolveWithObject: true,
        });
    return sharp(color.data, {
        raw: {
            width: color.info.width,
            height: color.info.height,
            channels: color.info.channels,
        },
    }).linear(
        [...tint],
        [
            0,
            0,
            0,
        ],
    );
}

/**
 * Opens a single-band 8-bit image from a NASA Planetary Data System (PDS3) volume. Its plain text
 * label sits in front of the pixels and says where they start.
 */
async function openPdsGrayMap(source: Readonly<DownloadSource>) {
    const bytes = await download(source);
    const labelLines = bytes.toString('latin1', 0, bytes.indexOf('\r\nEND\r\n')).split('\r\n');
    function readLabel(key: string) {
        const line = labelLines.find((entry) => entry.split('=')[0]?.trim() === key);
        if (!line) {
            throw new Error(`PDS label in '${source.fileName}' has no '${key}'.`);
        }
        return Number(line.split('=')[1]);
    }
    if (readLabel('SAMPLE_BITS') !== 8 || readLabel('BANDS') !== 1) {
        throw new Error(`'${source.fileName}' is not a single band of 8-bit samples.`);
    }
    const width = readLabel('LINE_SAMPLES');
    const height = readLabel('LINES');
    /** `^IMAGE` counts records from 1. */
    const dataStart = (readLabel('^IMAGE') - 1) * readLabel('RECORD_BYTES');
    return sharp(bytes.subarray(dataStart, dataStart + width * height), {
        raw: {
            width,
            height,
            channels: 1,
        },
    });
}

/** Creates the download source for a map in USGS' mosaic collection. */
function usgsMosaic({dirName, fileName}: Readonly<Omit<DownloadSource, 'url'>>) {
    return {
        dirName,
        fileName,
        url: `https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/${fileName}`,
    };
}

/**
 * Opens a FITS image of 32-bit float red, green, and blue planes already scaled 0 to 255, which is
 * how NASA's Planetary Data System publishes Cassini's color maps.
 */
async function openFitsColorMap(source: Readonly<DownloadSource>) {
    const bytes = await download(source);
    /** FITS headers are 80 character cards, padded out to whole 2880 byte blocks. */
    const cards = createArray(bytes.length / 80, (index) => {
        return bytes.toString('latin1', index * 80, (index + 1) * 80);
    });
    const endIndex = cards.findIndex((card) => card.startsWith('END '));
    function readCard(key: string) {
        const card = cards.slice(0, endIndex).find((entry) => entry.slice(0, 8).trim() === key);
        if (!card) {
            throw new Error(`FITS header in '${source.fileName}' has no '${key}'.`);
        }
        return Number(card.slice(10).split('/')[0]);
    }
    if (readCard('BITPIX') !== -32 || readCard('NAXIS3') !== 3) {
        throw new Error(`'${source.fileName}' is not three planes of 32-bit floats.`);
    }
    const width = readCard('NAXIS1');
    const height = readCard('NAXIS2');
    const dataStart = Math.ceil(((endIndex + 1) * 80) / 2880) * 2880;
    const planeLength = width * height;
    const rgb = Buffer.from(
        createArray(planeLength * 3, (index) => {
            const plane = index % 3;
            const pixel = Math.floor(index / 3);
            return Math.round(bytes.readFloatBE(dataStart + 4 * (plane * planeLength + pixel)));
        }),
    );
    return sharp(rgb, {
        raw: {
            width,
            height,
            channels: 3,
        },
    });
}

type HexColor = `#${string}`;

function parseHexColor(color: HexColor) {
    return [
        1,
        3,
        5,
    ].map((start) => Number.parseInt(color.slice(start, start + 2), 16));
}

/**
 * Smooth random noise from 0 to 1 that wraps around in `x` every `periodX` units, so a map drawn
 * from it has no seam where its left and right edges meet.
 */
function createWrappingNoise(random: () => number) {
    const latticeSize = 512;
    const lattice = createArray(latticeSize * latticeSize, () => random());
    function readLattice({x, y}: Readonly<{x: number; y: number}>) {
        const wrappedX = ((x % latticeSize) + latticeSize) % latticeSize;
        const wrappedY = ((y % latticeSize) + latticeSize) % latticeSize;
        return lattice[wrappedX + wrappedY * latticeSize] ?? 0;
    }
    function smooth(value: number) {
        return value * value * (3 - 2 * value);
    }
    return function noise({x, y, periodX}: Readonly<{x: number; y: number; periodX: number}>) {
        const left = Math.floor(x);
        const top = Math.floor(y);
        const right = (left + 1) % periodX;
        const xShare = smooth(x - left);
        const yShare = smooth(y - top);
        const topValue =
            readLattice({
                x: left % periodX,
                y: top,
            }) *
                (1 - xShare) +
            readLattice({
                x: right,
                y: top,
            }) *
                xShare;
        const bottomValue =
            readLattice({
                x: left % periodX,
                y: top + 1,
            }) *
                (1 - xShare) +
            readLattice({
                x: right,
                y: top + 1,
            }) *
                xShare;
        return topValue * (1 - yShare) + bottomValue * yShare;
    };
}

/**
 * No public domain global map exists for Uranus or Neptune, so these draw their cloud bands from
 * colors at set latitudes. Noise bends the bands and streaks them east to west like their winds do,
 * and `features` paints in spots and bright clouds.
 */
function createBandedMap({
    stops,
    seed,
    bandWaviness,
    streakContrast,
    features,
}: Readonly<{
    /** From north to south. */
    stops: ReadonlyArray<
        Readonly<{
            latitudeDegrees: number;
            color: HexColor;
        }>
    >;
    seed: number;
    /** How far the bands bend north and south, in degrees of latitude. */
    bandWaviness: number;
    /** How much the fine streaks brighten and darken the bands, as a share. */
    streakContrast: number;
    features: ReadonlyArray<
        Readonly<{
            longitudeDegrees: number;
            latitudeDegrees: number;
            widthDegrees: number;
            heightDegrees: number;
            color: HexColor;
            /** From 0 to 1. */
            opacity: number;
        }>
    >;
}>) {
    const noise = createWrappingNoise(createRandom(seed));
    /** Noise summed across octaves, each twice as detailed and half as strong as the last. */
    function layeredNoise({
        longitudeShare,
        latitudeShare,
        widthFrequency,
        heightFrequency,
        octaves,
    }: Readonly<{
        longitudeShare: number;
        latitudeShare: number;
        widthFrequency: number;
        heightFrequency: number;
        octaves: number;
    }>) {
        const layers = createArray(octaves, (octave) => {
            const scale = 2 ** octave;
            return {
                weight: 1 / scale,
                value: noise({
                    x: longitudeShare * widthFrequency * scale,
                    y: latitudeShare * heightFrequency * scale + octave * 97,
                    periodX: widthFrequency * scale,
                }),
            };
        });
        const totalWeight = layers.reduce((sum, layer) => sum + layer.weight, 0);
        return layers.reduce((sum, layer) => sum + layer.value * layer.weight, 0) / totalWeight;
    }
    const stopColors = stops.map((stop) => {
        return {
            latitudeDegrees: stop.latitudeDegrees,
            rgb: parseHexColor(stop.color),
        };
    });
    function readBandColor(latitudeDegrees: number) {
        const clampedLatitude = Math.max(-90, Math.min(90, latitudeDegrees));
        const southIndex = Math.max(
            1,
            stopColors.findIndex((stop) => stop.latitudeDegrees <= clampedLatitude),
        );
        const north = stopColors[southIndex - 1];
        const south = stopColors[southIndex];
        if (!north || !south) {
            throw new Error(`Band stops do not cover latitude ${clampedLatitude}.`);
        }
        const share =
            (north.latitudeDegrees - clampedLatitude) /
            (north.latitudeDegrees - south.latitudeDegrees);
        return north.rgb.map((northValue, index) => {
            return northValue + ((south.rgb[index] ?? northValue) - northValue) * share;
        });
    }
    const featureColors = features.map((feature) => {
        return {
            ...feature,
            rgb: parseHexColor(feature.color),
        };
    });
    const {width, height} = surfaceMapSize;
    const rows = createArray(height, (row) => {
        const latitudeShare = (row + 0.5) / height;
        const latitudeDegrees = 90 - latitudeShare * 180;
        const pixels = createArray(width, (column) => {
            const longitudeShare = (column + 0.5) / width;
            const longitudeDegrees = longitudeShare * 360 - 180;
            const bend =
                (layeredNoise({
                    longitudeShare,
                    latitudeShare,
                    widthFrequency: 6,
                    heightFrequency: 12,
                    octaves: 3,
                }) -
                    0.5) *
                2 *
                bandWaviness;
            const streak = layeredNoise({
                longitudeShare,
                latitudeShare: latitudeShare + bend / 180,
                widthFrequency: 16,
                heightFrequency: 256,
                octaves: 5,
            });
            const wisp = layeredNoise({
                longitudeShare,
                latitudeShare: latitudeShare + 0.5,
                widthFrequency: 12,
                heightFrequency: 48,
                octaves: 4,
            });
            const brightness = 1 + (streak - 0.5) * 2 * streakContrast;
            const bandColor = readBandColor(latitudeDegrees + bend).map(
                (value) => value * brightness,
            );
            return featureColors
                .reduce((color, feature) => {
                    const longitudeOffset =
                        ((((longitudeDegrees - feature.longitudeDegrees + 180) % 360) + 360) %
                            360) -
                        180;
                    const latitudeOffset = latitudeDegrees + bend * 0.3 - feature.latitudeDegrees;
                    const distance = Math.hypot(
                        longitudeOffset / (feature.widthDegrees / 2),
                        latitudeOffset / (feature.heightDegrees / 2),
                    );
                    /** Noise frays the feature's edge and thins it into wisps. */
                    const frayedDistance = distance * (0.7 + wisp * 0.6);
                    const share =
                        feature.opacity *
                        Math.max(0, Math.min(1, (1 - frayedDistance) / 0.6)) *
                        Math.min(1, 0.4 + wisp);
                    return color.map((value, index) => {
                        return value + ((feature.rgb[index] ?? value) - value) * share;
                    });
                }, bandColor)
                .map((value) => Math.max(0, Math.min(255, Math.round(value))));
        });
        return Buffer.from(pixels.flat());
    });
    return sharp(Buffer.concat(rows), {
        raw: {
            width,
            height,
            channels: 3,
        },
    });
}

const surfaceMapLoaders: Record<SurfaceMapBodyId, () => Promise<Sharp>> = {
    /**
     * MESSENGER's final color map, which exaggerates Mercury's subtle colors, muted back toward its
     * true brownish gray.
     */
    async [BodyId.Mercury]() {
        return (
            await fillUnseen(
                await openMap(
                    usgsMosaic({
                        dirName: 'messenger-mercury',
                        fileName: 'Mercury_MESSENGER_MDIS_Basemap_MD3Color_Mosaic_Global_665m.tif',
                    }),
                ),
            )
        )
            .modulate({
                saturation: 0.3,
            })
            .linear(
                [
                    1.06,
                    1,
                    0.92,
                ],
                [
                    0,
                    0,
                    0,
                ],
            );
    },
    /** Magellan radar brightness colored like the surface under Venus' clouds. */
    async [BodyId.Venus]() {
        return await openMap({
            dirName: 'magellan-venus',
            fileName: 'Venus_Magellan_C3-MDIR_Colorized_Global_Mosaic_4641m.tif',
            url: 'https://planetarymaps.usgs.gov/mosaic/Venus_Magellan_C3-MDIR_Colorized_Global_Mosaic_4641m.tif',
        });
    },
    async [BodyId.Mars]() {
        return await openMap({
            dirName: 'viking-mars',
            fileName: 'Mars_Viking_ClrMosaic_global_925m.tif',
            url: 'https://planetarymaps.usgs.gov/mosaic/Mars_Viking_ClrMosaic_global_925m.tif',
        });
    },
    async [BodyId.Phobos]() {
        return await tintGrayMap({
            map: await openMap(
                usgsMosaic({
                    dirName: 'viking-phobos',
                    fileName: 'Phobos_Viking_Mosaic_40ppd_DLRcontrol.tif',
                }),
            ),
            tint: [
                1.05,
                0.97,
                0.9,
            ],
        });
    },
    /** Cassini's December 2000 map. Jupiter's clouds drift, so its longitudes are not lined up. */
    async [BodyId.Jupiter]() {
        return await openMap({
            dirName: 'cassini-jupiter',
            fileName: 'PIA07782.tif',
            url: 'https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia07/pia07782/PIA07782.tif',
        });
    },
    async [BodyId.Io]() {
        return await openMap(
            usgsMosaic({
                dirName: 'galileo-io',
                fileName: 'Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km.tif',
            }),
        );
    },
    async [BodyId.Europa]() {
        return await tintGrayMap({
            map: await fillUnseen(
                await openMapStartingAtPrimeMeridian(
                    usgsMosaic({
                        dirName: 'galileo-europa',
                        fileName: 'Europa_Voyager_GalileoSSI_global_mosaic_500m.tif',
                    }),
                ),
            ),
            tint: [
                1.05,
                1,
                0.9,
            ],
        });
    },
    async [BodyId.Ganymede]() {
        return await fillUnseen(
            await openMapStartingAtPrimeMeridian(
                usgsMosaic({
                    dirName: 'galileo-ganymede',
                    fileName: 'Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m.tif',
                }),
            ),
        );
    },
    async [BodyId.Callisto]() {
        return await tintGrayMap({
            map: await fillUnseen(
                await openMapStartingAtPrimeMeridian(
                    usgsMosaic({
                        dirName: 'galileo-callisto',
                        fileName: 'Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif',
                    }),
                ),
            ),
            tint: [
                1,
                0.92,
                0.82,
            ],
        });
    },
    /**
     * Cassini's August 2011 true color map, its unseen poles and ring shadow filled in, with its
     * faint bands strengthened.
     */
    async [BodyId.Saturn]() {
        const fitsMap = await openFitsColorMap({
            dirName: 'cassini-saturn',
            fileName: 'Cassini_ISS_RGB_Saturn_global_color_map_original.fits',
            url: 'https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/co_iss_global-maps/data_derived/Cassini_ISS_RGB_Saturn_global_color_map_original.fits',
        });
        const {width, height} = await fitsMap.metadata();
        /**
         * Smooth resizing leaves the unseen equator strip with a dark edge too bright for
         * `fillUnseen` to count as unseen, so this resizes to full size by nearest pixel first.
         */
        const resized = await fitsMap
            /** Its first column is dim, and its last repeats its first, at 360°. */
            .extract({
                left: 1,
                top: 0,
                width: width - 1,
                height,
            })
            .resize(surfaceMapSize.width, surfaceMapSize.height, {
                kernel: 'nearest',
            })
            .raw()
            .toBuffer({
                resolveWithObject: true,
            });
        return (
            await fillUnseen(
                await centerPrimeMeridian(
                    sharp(resized.data, {
                        raw: resized.info,
                    }),
                ),
            )
        ).linear(
            [
                2.2,
                2.2,
                2.2,
            ],
            [
                -286,
                -252,
                -199,
            ],
        );
    },
    async [BodyId.Mimas]() {
        return await tintGrayMap({
            map: await openPdsGrayMap({
                dirName: 'cassini-mimas',
                fileName: 'SM_1M_0_0_SIMP.IMG',
                url: 'https://planetarydata.jpl.nasa.gov/img/data/cassini/cassini_orbiter/coiss_3006/data/images/SM_1M_0_0_SIMP.IMG',
            }),
            tint: [
                1,
                0.98,
                0.95,
            ],
        });
    },
    async [BodyId.Enceladus]() {
        return await tintGrayMap({
            map: await openMap(
                usgsMosaic({
                    dirName: 'cassini-enceladus',
                    fileName: 'Enceladus_Cassini_mosaic_global_110m.tif',
                }),
            ),
            tint: [
                0.98,
                1,
                1.02,
            ],
        });
    },
    async [BodyId.Tethys]() {
        return await tintGrayMap({
            map: await openMap(
                usgsMosaic({
                    dirName: 'cassini-tethys',
                    fileName: 'Tethys_Cassini_mosaic_global_293m.tif',
                }),
            ),
            tint: [
                1,
                1,
                0.98,
            ],
        });
    },
    async [BodyId.Dione]() {
        return await tintGrayMap({
            map: await openMap(
                usgsMosaic({
                    dirName: 'cassini-dione',
                    fileName: 'Dione_Cassini_Voyager_mosaic_global_154m.tif',
                }),
            ),
            tint: [
                1,
                0.99,
                0.96,
            ],
        });
    },
    async [BodyId.Rhea]() {
        return await tintGrayMap({
            map: await openMap(
                usgsMosaic({
                    dirName: 'cassini-rhea',
                    fileName: 'Rhea_Cassini_Voyager_mosaic_global_417m.tif',
                }),
            ),
            tint: [
                1,
                0.98,
                0.95,
            ],
        });
    },
    /**
     * Cassini saw the ground in near infrared, through the haze. The tint is a guess at the
     * ground's color.
     */
    async [BodyId.Titan]() {
        return await tintGrayMap({
            map: await openMapStartingAtPrimeMeridian(
                usgsMosaic({
                    dirName: 'cassini-titan',
                    fileName: 'Titan_ISS_P19658_Mosaic_Global_4km.tif',
                }),
            ),
            tint: [
                1.1,
                0.85,
                0.6,
            ],
        });
    },
    async [BodyId.Iapetus]() {
        return await tintGrayMap({
            map: await openMap(
                usgsMosaic({
                    dirName: 'cassini-iapetus',
                    fileName: 'Iapetus_Cassini_Voyager_mosaic_global_783m.tif',
                }),
            ),
            tint: [
                1.02,
                0.96,
                0.88,
            ],
        });
    },
    /**
     * Uranus shows little through its haze: faint bands, a brighter polar cap, and a few small
     * bright clouds.
     */
    [BodyId.Uranus]() {
        return Promise.resolve(
            createBandedMap({
                seed: 7,
                bandWaviness: 1.5,
                streakContrast: 0.02,
                stops: [
                    {
                        latitudeDegrees: 90,
                        color: '#d9f2f2',
                    },
                    {
                        latitudeDegrees: 62,
                        color: '#cdeeef',
                    },
                    {
                        latitudeDegrees: 55,
                        color: '#b4e2e6',
                    },
                    {
                        latitudeDegrees: 40,
                        color: '#a9dbe1',
                    },
                    {
                        latitudeDegrees: 25,
                        color: '#b1dfe4',
                    },
                    {
                        latitudeDegrees: 10,
                        color: '#a3d6dd',
                    },
                    {
                        latitudeDegrees: -10,
                        color: '#a0d4db',
                    },
                    {
                        latitudeDegrees: -25,
                        color: '#a8d9df',
                    },
                    {
                        latitudeDegrees: -45,
                        color: '#a6d8de',
                    },
                    {
                        latitudeDegrees: -70,
                        color: '#b5e0e5',
                    },
                    {
                        latitudeDegrees: -90,
                        color: '#c4e7eb',
                    },
                ],
                features: [
                    {
                        longitudeDegrees: -40,
                        latitudeDegrees: 32,
                        widthDegrees: 9,
                        heightDegrees: 2.5,
                        color: '#effbfb',
                        opacity: 0.7,
                    },
                    {
                        longitudeDegrees: 75,
                        latitudeDegrees: 27,
                        widthDegrees: 14,
                        heightDegrees: 2,
                        color: '#e6f8f9',
                        opacity: 0.5,
                    },
                    {
                        longitudeDegrees: 150,
                        latitudeDegrees: -34,
                        widthDegrees: 7,
                        heightDegrees: 2,
                        color: '#e6f8f9',
                        opacity: 0.45,
                    },
                ],
            }),
        );
    },
    /**
     * Neptune as Voyager 2 saw it in 1989, with the Great Dark Spot, the Scooter, and the second
     * dark spot.
     */
    [BodyId.Neptune]() {
        return Promise.resolve(
            createBandedMap({
                seed: 8,
                bandWaviness: 3,
                streakContrast: 0.07,
                stops: [
                    {
                        latitudeDegrees: 90,
                        color: '#4f74c8',
                    },
                    {
                        latitudeDegrees: 60,
                        color: '#466cc6',
                    },
                    {
                        latitudeDegrees: 45,
                        color: '#5378cf',
                    },
                    {
                        latitudeDegrees: 30,
                        color: '#3e63c0',
                    },
                    {
                        latitudeDegrees: 10,
                        color: '#3a5ebc',
                    },
                    {
                        latitudeDegrees: -10,
                        color: '#3b60be',
                    },
                    {
                        latitudeDegrees: -25,
                        color: '#4369c4',
                    },
                    {
                        latitudeDegrees: -40,
                        color: '#4a70c9',
                    },
                    {
                        latitudeDegrees: -55,
                        color: '#3c5fb8',
                    },
                    {
                        latitudeDegrees: -65,
                        color: '#34559f',
                    },
                    {
                        latitudeDegrees: -72,
                        color: '#5a7ed0',
                    },
                    {
                        latitudeDegrees: -90,
                        color: '#6a8ad4',
                    },
                ],
                features: [
                    {
                        longitudeDegrees: -20,
                        latitudeDegrees: -20,
                        widthDegrees: 32,
                        heightDegrees: 14,
                        color: '#1a3380',
                        opacity: 1,
                    },
                    {
                        longitudeDegrees: -24,
                        latitudeDegrees: -29,
                        widthDegrees: 26,
                        heightDegrees: 3.5,
                        color: '#f2f6ff',
                        opacity: 0.85,
                    },
                    {
                        longitudeDegrees: -8,
                        latitudeDegrees: -12,
                        widthDegrees: 12,
                        heightDegrees: 2.5,
                        color: '#e6eeff',
                        opacity: 0.6,
                    },
                    {
                        longitudeDegrees: 70,
                        latitudeDegrees: -42,
                        widthDegrees: 8,
                        heightDegrees: 4,
                        color: '#eef3ff',
                        opacity: 0.85,
                    },
                    {
                        longitudeDegrees: 150,
                        latitudeDegrees: -55,
                        widthDegrees: 14,
                        heightDegrees: 7,
                        color: '#223f8c',
                        opacity: 0.8,
                    },
                    {
                        longitudeDegrees: 150,
                        latitudeDegrees: -55,
                        widthDegrees: 4,
                        heightDegrees: 2.5,
                        color: '#dfe8ff',
                        opacity: 0.8,
                    },
                    {
                        longitudeDegrees: 100,
                        latitudeDegrees: 27,
                        widthDegrees: 40,
                        heightDegrees: 2,
                        color: '#e3ebff',
                        opacity: 0.55,
                    },
                    {
                        longitudeDegrees: -120,
                        latitudeDegrees: 31,
                        widthDegrees: 28,
                        heightDegrees: 1.5,
                        color: '#e3ebff',
                        opacity: 0.45,
                    },
                    {
                        longitudeDegrees: -150,
                        latitudeDegrees: -68,
                        widthDegrees: 50,
                        heightDegrees: 2,
                        color: '#d9e3ff',
                        opacity: 0.35,
                    },
                ],
            }),
        );
    },
    async [BodyId.Triton]() {
        return await fillUnseen(
            await openMap(
                usgsMosaic({
                    dirName: 'voyager-triton',
                    fileName: 'Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif',
                }),
            ),
        );
    },
    /** New Horizons only saw the north well, so the south is filled in. */
    async [BodyId.Pluto]() {
        return await tintGrayMap({
            map: await fillUnseen(
                await openMapStartingAtPrimeMeridian(
                    usgsMosaic({
                        dirName: 'new-horizons-pluto',
                        fileName: 'Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif',
                    }),
                ),
            ),
            tint: [
                1.15,
                0.95,
                0.75,
            ],
        });
    },
    /** Like Pluto, the south New Horizons never saw is filled in. */
    async [BodyId.Charon]() {
        return await tintGrayMap({
            map: await fillUnseen(
                await openMap(
                    usgsMosaic({
                        dirName: 'new-horizons-charon',
                        fileName: 'Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif',
                    }),
                ),
            ),
            tint: [
                1.02,
                0.98,
                0.94,
            ],
        });
    },
};

async function main() {
    /** One at a time, since the largest source maps each take most of a gigabyte to decode. */
    await awaitedForEach(
        getObjectTypedEntries(surfaceMapLoaders),
        async ([
            bodyId,
            loadMap,
        ]) => {
            const outputDirPath = createSurfaceMapOutputDirPath(bodyId);
            await mkdir(outputDirPath, {
                recursive: true,
            });
            const map = await loadMap();
            await Promise.all(
                [
                    {
                        size: surfaceMapSize,
                        fileName: surfaceMapFileNames.surfaceColor,
                    },
                    {
                        size: surfaceMapSmallSize,
                        fileName: surfaceMapFileNames.surfaceColorSmall,
                    },
                ].map(async ({size, fileName}) => {
                    await map
                        .clone()
                        .resize(size.width, size.height)
                        .toColourspace('srgb')
                        .jpeg({
                            quality: 85,
                            mozjpeg: true,
                        })
                        .toFile(join(outputDirPath, fileName));
                }),
            );
        },
    );
    log.success(
        `Wrote ${Object.values(surfaceMapFileNames).join(', ')} for ${Object.keys(surfaceMapLoaders).join(', ')}`,
    );
}

await main();
