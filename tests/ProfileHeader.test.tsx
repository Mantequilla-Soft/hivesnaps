jest.mock('expo-image', () => {
    const { View } = require('react-native');
    return { Image: (props: object) => require('react').createElement(View, { ...props, testID: 'cover' }) };
});
jest.mock('@expo/vector-icons', () => ({ FontAwesome: () => null }));

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ProfileHeader } from '../app/components/profile/ProfileHeader';
import { createProfileScreenStyles } from '../styles/ProfileScreenStyles';

const colors = { background: '#fff', text: '#000', bubble: '#eee', icon: '#333' };
const styles = createProfileScreenStyles(false);

function render(coverUrl?: string): ReactTestRenderer {
    let r!: ReactTestRenderer;
    act(() => {
        r = create(
            <ProfileHeader
                username="meno"
                coverUrl={coverUrl}
                isOwnProfile={false}
                colors={colors}
                styles={styles}
                onEditProfilePress={() => {}}
            />
        );
    });
    return r;
}
const covers = (r: ReactTestRenderer) => r.root.findAll((n) => n.props.testID === 'cover' && typeof n.type !== 'string');

it('shows the cover image when there is one', () => {
    const r = render('https://files.peakd.com/cover.jpg');
    expect(covers(r)).toHaveLength(1);
    expect(covers(r)[0].props.contentFit).toBe('cover');
});

it('shows only the plain banner when there is no cover or it is not a web URL', () => {
    expect(covers(render(undefined))).toHaveLength(0);
    expect(covers(render(''))).toHaveLength(0);
    expect(covers(render('not a url'))).toHaveLength(0);
});

it('falls back to the plain banner when the cover fails to load, and retries a new URL', () => {
    const r = render('https://cdn.discordapp.com/attachments/dead.png');
    act(() => covers(r)[0].props.onError());
    expect(covers(r)).toHaveLength(0);
    act(() => {
        r.update(
            <ProfileHeader
                username="meno"
                coverUrl="https://files.peakd.com/new.jpg"
                isOwnProfile={false}
                colors={colors}
                styles={styles}
                onEditProfilePress={() => {}}
            />
        );
    });
    expect(covers(r)).toHaveLength(1);
});
