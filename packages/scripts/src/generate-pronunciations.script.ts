// cspell:words dtype libmp pretrained
/**
 * Speaks every body's `pronunciation` with Kokoro and writes one MP3 per body to
 * `packages/frontend/www-static/pronunciations/`. Output is identical on every run, so only clips
 * whose phonemes changed show up in a diff. Needs `ffmpeg` on the path:
 *
 *     npm run build:pronunciations --workspace @cosmos/scripts
 */
import {assertWrap} from '@augment-vir/assert';
import {awaitedForEach, getObjectTypedValues, log} from '@augment-vir/common';
import {bodyCatalog} from '@cosmos/frontend/src/data/body-catalog.js';
import {Tensor} from '@huggingface/transformers';
import {KokoroTTS} from 'kokoro-js';
import {spawn} from 'node:child_process';
import {mkdir, readFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pronunciationsDirPath} from './file-paths.js';

function encodeMp3({
    samples,
    sampleRate,
    outputFilePath,
}: Readonly<{
    samples: Float32Array;
    sampleRate: number;
    outputFilePath: string;
}>) {
    return new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line sonarjs/no-os-command-from-path -- this local build script runs whichever `ffmpeg` the developer installed
        const ffmpeg = spawn('ffmpeg', [
            '-v',
            'error',
            '-y',
            '-f',
            'f32le',
            '-ar',
            `${sampleRate}`,
            '-ac',
            '1',
            '-i',
            '-',
            '-c:a',
            'libmp3lame',
            '-b:a',
            '40k',
            outputFilePath,
        ]);
        ffmpeg.on('error', reject);
        ffmpeg.on('close', (code) => {
            if (code) {
                reject(
                    new Error(`ffmpeg exited with code ${code} while writing '${outputFilePath}'.`),
                );
            } else {
                resolve();
            }
        });
        ffmpeg.stdin.end(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength));
    });
}

/**
 * Cuts the leading silence so a press starts speaking right away. The threshold sits low enough to
 * keep Earth's slowly rising first vowel, which a higher one cut down to just the "th". The end
 * stays: trimming it too cuts off quiet final sounds.
 */
function trimLeadingSilence({
    samples,
    sampleRate,
}: Readonly<{
    samples: Float32Array;
    sampleRate: number;
}>) {
    const firstSoundIndex = samples.findIndex((sample) => Math.abs(sample) > 0.0005);
    return samples.subarray(Math.max(0, firstSoundIndex - Math.round(0.05 * sampleRate)));
}

/** Kokoro always outputs 24 kHz audio. */
const sampleRate = 24_000;

async function generatePronunciations() {
    await mkdir(pronunciationsDirPath, {
        recursive: true,
    });
    const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'fp32',
        device: 'cpu',
    });
    const voiceStyles = new Float32Array(
        (
            await readFile(
                join(
                    dirname(fileURLToPath(import.meta.resolve('kokoro-js'))),
                    '..',
                    'voices',
                    'af_heart.bin',
                ),
            )
        ).buffer,
    );

    const bodies = getObjectTypedValues(bodyCatalog);
    await awaitedForEach(bodies, async (body) => {
        /** The full stop gives Kokoro a sentence ending; bare words come out sounding garbled. */
        const inputIds = tts.tokenizer(`${body.pronunciation}.`).input_ids;
        /**
         * The voice holds one style per phoneme count. Kokoro's own pipeline picks row `count - 1`,
         * but kokoro-js's `generate_from_ids` picks row `count`. The count leaves out the two
         * padding tokens the tokenizer adds.
         */
        const styleRow = assertWrap.isDefined(inputIds.dims.at(-1)) - 3;
        const {waveform} = await tts.model({
            input_ids: inputIds,
            style: new Tensor(
                'float32',
                voiceStyles.subarray(styleRow * 256, styleRow * 256 + 256),
                [
                    1,
                    256,
                ],
            ),
            speed: new Tensor('float32', [1], [1]),
        });
        await encodeMp3({
            samples: trimLeadingSilence({
                samples: waveform.data,
                sampleRate,
            }),
            sampleRate,
            outputFilePath: join(pronunciationsDirPath, `${body.id}.mp3`),
        });
    });

    log.success(`Wrote ${bodies.length} pronunciations to ${pronunciationsDirPath}`);
}

try {
    await generatePronunciations();
} catch (error) {
    log.error(error);
    process.exit(1);
}
