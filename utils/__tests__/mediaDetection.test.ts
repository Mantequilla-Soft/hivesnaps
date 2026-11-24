jest.mock('../../services/audioUploadService', () => ({
    extractAudioPermlink: (url: string) => new URL(url).searchParams.get('a'),
}));

import { detectMediaInBody, hasAudioEmbed } from '../mediaDetection';

describe('detectMediaInBody: 3Speak audio', () => {
    it('keeps handling player links', () => {
        const m = detectMediaInBody('Hi https://audio.3speak.tv/play?a=lr4gk9js');
        expect(m.audioUrl).toBe('https://audio.3speak.tv/play?a=lr4gk9js');
        expect(m.audioPermlink).toBe('lr4gk9js');
        expect(m.cleanBody).toBe('Hi');
        expect(m.hasVideo).toBe(false);
    });

    it('turns share links into player links instead of treating them as videos', () => {
        const audio = detectMediaInBody('New episode: https://3speak.tv/audio?play=shainemata/lr4gk9js');
        expect(audio).toEqual(expect.objectContaining({
            hasAudio: true,
            hasVideo: false,
            audioUrl: 'https://audio.3speak.tv/play?a=lr4gk9js',
            audioPermlink: 'lr4gk9js',
            cleanBody: 'New episode:',
        }));

        const playlist = detectMediaInBody('My mix https://3speak.tv/playlist/abc12345');
        expect(playlist).toEqual(expect.objectContaining({
            hasAudio: true,
            hasVideo: false,
            audioUrl: 'https://audio.3speak.tv/play?list=abc12345',
        }));
    });

    it('still finds a video next to an audio link', () => {
        const m = detectMediaInBody('https://3speak.tv/audio?play=abc https://play.3speak.tv/watch?v=alice/clip');
        expect(m.audioUrl).toBe('https://audio.3speak.tv/play?a=abc');
        expect(m.videoUrl).toBe('https://play.3speak.tv/watch?v=alice/clip');
    });

    it('does not crash on a malformed escape in a playlist link', () => {
        expect(() => detectMediaInBody('mix https://3speak.tv/playlist/100%')).not.toThrow();
        expect(detectMediaInBody('mix https://3speak.tv/playlist/100%').audioUrl).toBe('https://audio.3speak.tv/play?list=100%25');
    });

    it('leaves links it cannot turn into a player as plain links', () => {
        const m = detectMediaInBody('see https://3speak.tv/playlist/abc/def and https://3speak.tv/audio?play=/');
        expect(m.hasAudio).toBe(false);
        expect(m.audioUrl).toBeNull();
        // (The snap text keeps them: see stripSpeakAudioLinks in speakAudio.test.)
    });

    it('accepts player links with the id in any parameter position', () => {
        expect(detectMediaInBody('https://audio.3speak.tv/play?mode=compact&a=x').audioUrl).toBe('https://audio.3speak.tv/play?a=x');
    });
});

it('hasAudioEmbed recognizes share links', () => {
    expect(hasAudioEmbed('see https://3speak.tv/audio?play=abc')).toBe(true);
    expect(hasAudioEmbed('see https://3speak.tv/watch?v=a/b')).toBe(false);
});
