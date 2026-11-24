import { SPEAK_AUDIO_URL_PATTERN, speakPlaylistId, speakPlaylistPageUrl, stripSpeakAudioLinks, toSpeakAudioPlayerUrl } from '../speakAudio';

describe('toSpeakAudioPlayerUrl', () => {
    it.each([
        ['https://audio.3speak.tv/play?a=lr4gk9js', 'https://audio.3speak.tv/play?a=lr4gk9js'],
        ['https://audio.3speak.tv/play?a=lr4gk9js&mode=compact&iframe=1', 'https://audio.3speak.tv/play?a=lr4gk9js'],
        ['https://audio.3speak.tv/play?list=abc12345', 'https://audio.3speak.tv/play?list=abc12345'],
        ['https://audio.3speak.tv/play?cid=QmX', 'https://audio.3speak.tv/play?cid=QmX'],
        ['http://audio.3speak.tv/play?a=x&amp;mode=compact', 'https://audio.3speak.tv/play?a=x'],
        ['https://3speak.tv/audio?play=lr4gk9js', 'https://audio.3speak.tv/play?a=lr4gk9js'],
        ['https://3speak.tv/audio/?play=shainemata/lr4gk9js', 'https://audio.3speak.tv/play?a=lr4gk9js'],
        ['https://www.3speak.tv/playlist/abc12345', 'https://audio.3speak.tv/play?list=abc12345'],
        ['https://3speak.tv/playlist/abc12345/', 'https://audio.3speak.tv/play?list=abc12345'],
    ])('%s → %s', (input, out) => expect(toSpeakAudioPlayerUrl(input)).toBe(out));

    it.each([
        'https://3speak.tv/watch?v=a/b',
        'https://play.3speak.tv/watch?v=a/b',
        'https://3speak.tv/audio',
        'https://audio.3speak.tv/play',
        'https://example.com/play?a=x',
        'not a url',
    ])('rejects %s', (input) => expect(toSpeakAudioPlayerUrl(input)).toBeNull());
});

it('finds every link shape in text, without trailing punctuation', () => {
    const text = 'Listen (https://3speak.tv/audio?play=abc) and https://3speak.tv/playlist/xyz, plus https://audio.3speak.tv/play?list=l1.';
    expect(text.match(SPEAK_AUDIO_URL_PATTERN)).toEqual([
        'https://3speak.tv/audio?play=abc',
        'https://3speak.tv/playlist/xyz',
        'https://audio.3speak.tv/play?list=l1',
    ]);
});

it('reads playlist ids and builds the 3Speak page', () => {
    expect(speakPlaylistId('https://audio.3speak.tv/play?list=abc')).toBe('abc');
    expect(speakPlaylistId('https://audio.3speak.tv/play?a=abc')).toBeNull();
    expect(speakPlaylistPageUrl('a b')).toBe('https://3speak.tv/playlist/a%20b');
});

describe('stripSpeakAudioLinks', () => {
    it('removes playable links and keeps the rest', () => {
        expect(stripSpeakAudioLinks('a https://3speak.tv/audio?play=x b https://3speak.tv/playlist/p/q c')).toBe('a  b https://3speak.tv/playlist/p/q c');
    });

    it('strips every text on back-to-back calls (no lastIndex carried over, unlike .test())', () => {
        const pattern = SPEAK_AUDIO_URL_PATTERN;
        // The shared pattern is global: .test() leaves lastIndex past the
        // first match, so a second .test() on a shorter text misses its link.
        pattern.test('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx https://3speak.tv/audio?play=first');
        expect(pattern.test('https://3speak.tv/audio?play=b')).toBe(false);
        pattern.lastIndex = 0;
        // stripSpeakAudioLinks (what Snap uses) is not affected.
        stripSpeakAudioLinks('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx https://3speak.tv/audio?play=first');
        expect(stripSpeakAudioLinks('https://3speak.tv/audio?play=b')).toBe('');
    });
});
