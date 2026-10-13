<!-- cspell:words Archinal Gitlin Hoffleit Hoffmeister Kersten Knowles Neakrase Roatsch Schenk Stöckli Stooke Wählisch basemap coiss Colvin Geophys Geosciences Jiang Laske lorri lroc mdir mdis mvic NSSDC Pasyanos reprojected Reto rkkb USGS Freie Universität -->

# Data and media attribution

The code in this repo is licensed under `LICENSE-MIT` and `LICENSE-CC0`. Those licenses do not cover the third-party data the files in `www-static/` are derived from. That data keeps its original terms, listed below. `packages/scripts` downloads each source and builds the files from it.

Nothing here implies endorsement by NASA, JPL, USGS, NOAA, DLR, or any other organization listed.

## Surface textures

Each `www-static/<body>/surface-color.jpg` and `surface-color-small.jpg` is reprojected, resized, and color adjusted from the source below. Built by `packages/scripts/src/build-surface-map-data.script.ts`.

USGS Astrogeology mosaics are U.S. Government works in the public domain. USGS asks for credit to the authors listed on each product page, with "USGS Astrogeology Science Center" as publisher. Product pages are under `https://astrogeology.usgs.gov/search/map/`.

| Body      | Source                                                                                       | Credit                                                                                                                                   | Terms                                           |
| --------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Mercury   | USGS `mercury_messenger_mdis_basemap_md3_color_global_mosaic_665m`                           | Applied Coherent Technology Corporation; NASA, JHU APL, Arizona State University, Carnegie Science                                       | Public domain (U.S. Government)                 |
| Venus     | USGS `venus_magellan_global_c3_mdir_synthetic_color_mosaic_4641m`                            | USGS Astrogeology Science Center; PDS Geosciences Node                                                                                   | Public domain                                   |
| Mars      | USGS `mars_viking_global_color_mosaic_925m`                                                  | USGS Astrogeology Science Center; NASA Planetary Data System                                                                             | Public domain                                   |
| Phobos    | USGS `phobos_viking_global_mosaic_5m` (40 ppd, DLR control)                                  | Phil Stooke; NASA Planetary Data System; control network by Wählisch et al. 2009                                                         | Public domain                                   |
| Jupiter   | NASA PIA07782, "Cassini's Best Maps of Jupiter"                                              | NASA/JPL/Space Science Institute                                                                                                         | NASA/JPL image use policy: free use with credit |
| Io        | USGS `io_galileo_ssi_voyager_color_merged_global_mosaic_1km`                                 | USGS Astrogeology Science Center; NASA PDS                                                                                               | Public domain                                   |
| Europa    | USGS `europa_voyager_galileo_ssi_global_mosaic_500m`                                         | Tammy Becker; Archinal, Colvin, Davies, Gitlin, Kirk, Weller                                                                             | Public domain (U.S. Government)                 |
| Ganymede  | USGS `ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km`                                | USGS Astrogeology Science Center                                                                                                         | Public domain                                   |
| Callisto  | USGS `callisto_galileo_voyager_global_mosaic_1km`                                            | USGS Astrogeology Science Center                                                                                                         | Public domain                                   |
| Saturn    | NASA PDS Atmospheres Node, "Cassini ISS Global Maps of Jupiter and Saturn"                   | Li, L., West, R., Jiang, X., Knowles, B. (2023), eds. Neakrase, L., Huber, L., doi:10.17189/rkkb-6y30                                    | NASA PDS archive data                           |
| Mimas     | NASA PDS volume `coiss_3006`, "Cassini ISS Cartographic Map of Mimas" (`SM_1M_0_0_SIMP.IMG`) | NASA/JPL/Space Science Institute; map processing by DLR and Freie Universität Berlin; Roatsch et al. 2018, doi:10.1016/j.pss.2018.05.021 | NASA PDS archive data                           |
| Enceladus | USGS `enceladus_cassini_global_mosaic_110m`                                                  | Cassini Team, NASA/JPL, Space Science Institute; Bland et al. 2018                                                                       | Public domain                                   |
| Tethys    | USGS `tethys_cassini_global_mosaic_293m`                                                     | Roatsch, T., Kersten, E., Hoffmeister, A., Wählisch, M.; NASA/JPL/SSI                                                                    | Public domain                                   |
| Dione     | USGS `dione_cassini_voyager_global_mosaic_154m`                                              | NASA/JPL/Space Science Institute                                                                                                         | Public domain                                   |
| Rhea      | USGS `rhea_cassini_voyager_global_mosaic_417m`                                               | Roatsch, Kersten, Hoffmeister, Wählisch; NASA/JPL/SSI                                                                                    | Public domain                                   |
| Titan     | USGS `titan_cassini_iss_global_mosaic_4005m`                                                 | Cassini ISS Team; NASA/JPL-Caltech/SSI                                                                                                   | Public domain (U.S. Government)                 |
| Iapetus   | USGS `iapetus_cassini_voyager_global_mosaic_803m`                                            | Space Science Institute, Cassini Team, NASA/JPL                                                                                          | Public domain                                   |
| Triton    | USGS `triton_voyager_2_global_color_mosaic_600m`                                             | Lunar and Planetary Institute; NASA/JPL; Paul Schenk                                                                                     | Public domain                                   |
| Pluto     | USGS `pluto_new_horizons_lorri_mvic_global_mosaic_300m`                                      | New Horizons Team; NASA, JHU APL, SwRI, LPI                                                                                              | Public domain (U.S. Government)                 |
| Charon    | USGS `charon_new_horizons_lorri_mvic_global_mosaic_300m`                                     | New Horizons Team; NASA, JHU APL, SwRI, LPI                                                                                              | Public domain (U.S. Government)                 |
| Moon      | NASA SVS 4720, CGI Moon Kit (`lroc_color_poles_4k.tif`)                                      | NASA's Scientific Visualization Studio                                                                                                   | Public domain                                   |
| Earth     | NASA Blue Marble: Next Generation, December 2004 (Visible Earth 73909)                       | NASA Earth Observatory (Reto Stöckli)                                                                                                    | NASA media policy: free use with credit         |

The Uranus and Neptune textures are generated procedurally by the same script. The Sun is drawn by a shader. None of the three use source imagery.

## Earth data

Built by `packages/scripts/src/build-earth-data.script.ts`.

-   `www-static/earth/elevation.bin`: NOAA National Centers for Environmental Information. 2022: ETOPO 2022 15 Arc-Second Global Relief Model (60 arc-second grid). doi:10.25921/fd45-gt74. Released under CC0-1.0. Not to be used for navigation.
-   `www-static/earth/crust.bin`: CRUST1.0. Laske, G., Masters, G., Ma, Z. and Pasyanos, M., Update on CRUST1.0 - A 1-degree Global Model of Earth's Crust, Geophys. Res. Abstracts, 15, Abstract EGU2013-2658, 2013. https://igppweb.ucsd.edu/~gabi/crust1.html. The authors ask for this citation and state no license.

## Stars

`www-static/sky/stars.bin`, built by `packages/scripts/src/build-sky-data.script.ts`, is derived from the Yale Bright Star Catalogue: Hoffleit, D., Warren Jr, W.H., The Bright Star Catalogue, 5th Revised Ed. (Preliminary Version), Astronomical Data Center, NSSDC/ADC (1991). Retrieved through VizieR catalog V/50. This research has made use of the VizieR catalogue access tool, CDS, Strasbourg, France (doi:10.26093/cds/vizier). CDS asks that the original authors be cited and states no other license.

## Pronunciations

`www-static/pronunciations/*.mp3` are generated speech from the Kokoro-82M v1.0 text-to-speech model (Apache-2.0), voice `af_heart`. Built by `packages/scripts/src/generate-pronunciations.script.ts`. The model's license places no restrictions on generated audio.

## Fonts

Atkinson Hyperlegible. See `www-static/fonts/atkinson-hyperlegible-license.txt`.
