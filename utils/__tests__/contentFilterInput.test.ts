import { parseRuleInput } from '../contentFilterInput';

describe('parseRuleInput', () => {
    it('reads a tag, with or without #', () => {
        expect(parseRuleInput('#Scroddle')).toEqual({ rule: { kind: 'tag', tag: 'scroddle' } });
        expect(parseRuleInput('  hiveword ')).toEqual({ rule: { kind: 'tag', tag: 'hiveword' } });
    });

    it('reads app:name as a whole-app rule, ignoring the version', () => {
        expect(parseRuleInput('app:HiveWord')).toEqual({ rule: { kind: 'app', app: 'hiveword' } });
        expect(parseRuleInput('App: hivesuite/0.1.262')).toEqual({ rule: { kind: 'app', app: 'hivesuite' } });
    });

    it('reads app:name #tag as an app + tag rule', () => {
        expect(parseRuleInput('app:hivesuite #Scratchcard')).toEqual({
            rule: { kind: 'app_tag', app: 'hivesuite', tag: 'scratchcard' },
        });
    });

    it('explains what is missing', () => {
        expect(parseRuleInput('')).toEqual({ error: expect.stringMatching(/#tag or app:name/) });
        expect(parseRuleInput('#')).toEqual({ error: expect.stringMatching(/#tag or app:name/) });
        expect(parseRuleInput('app:')).toEqual({ error: expect.stringMatching(/app name after app:/) });
        expect(parseRuleInput('app:hivesuite #')).toEqual({ error: expect.stringMatching(/tag after #/) });
        expect(parseRuleInput('two words')).toEqual({ error: expect.stringMatching(/One tag at a time/) });
    });
});
