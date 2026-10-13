/** Shared by every press, so a new press cuts off the name still being said. */
const nameAudio: {
    output:
        | {
              context: AudioContext;
              volume: GainNode;
          }
        | undefined;
    source: AudioBufferSourceNode | undefined;
    pressCount: number;
} = {
    output: undefined,
    source: undefined,
    pressCount: 0,
};

function createAudioOutput() {
    const context = new AudioContext();
    const volume = context.createGain();
    volume.gain.value = 1.4;
    volume.connect(context.destination);
    return {
        context,
        volume,
    };
}

/**
 * Plays a pre-recorded name from `www-static/pronunciations`. Cuts off any name still playing. Must
 * be called from a user gesture, or browsers keep the audio muted.
 */
export async function playPronunciation(fileUrl: string) {
    /**
     * Web Audio instead of an `<audio>` element: media elements claim the OS media session, so the
     * system media keys would replay the name.
     */
    nameAudio.output ??= createAudioOutput();
    const {context, volume} = nameAudio.output;
    void context.resume();
    nameAudio.source?.stop();
    nameAudio.source = undefined;
    nameAudio.pressCount++;
    const pressCount = nameAudio.pressCount;

    const response = await fetch(fileUrl);
    const buffer = await context.decodeAudioData(await response.arrayBuffer());

    /** A newer press started while this one was still loading. */
    if (nameAudio.pressCount !== pressCount) {
        return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(volume);
    source.start();
    nameAudio.source = source;
}
