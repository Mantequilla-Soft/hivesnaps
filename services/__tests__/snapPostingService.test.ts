import { postSnapWithBeneficiaries } from '../snapPostingService';

const key = {} as never;
const base = {
    parentAuthor: '',
    parentPermlink: 'hive-178315',
    author: 'me',
    permlink: 'p',
    title: 't',
    body: 'b',
    jsonMetadata: '{}',
    hasVideo: false,
};

function makeClient() {
    return {
        broadcast: {
            comment: jest.fn().mockResolvedValue({ id: 'c' }),
            sendOperations: jest.fn().mockResolvedValue({ id: 's' }),
        },
    };
}

const beneficiariesOf = (client: ReturnType<typeof makeClient>) =>
    client.broadcast.sendOperations.mock.calls[0][0][1][1].extensions[0][1].beneficiaries;

it('posts a plain comment when there are no beneficiaries', async () => {
    const client = makeClient();
    await postSnapWithBeneficiaries(client as never, base, key);
    expect(client.broadcast.comment).toHaveBeenCalled();
    expect(client.broadcast.sendOperations).not.toHaveBeenCalled();
});

it('keeps the existing @snapie shares', async () => {
    let client = makeClient();
    await postSnapWithBeneficiaries(client as never, { ...base, hasHangout: true }, key);
    expect(beneficiariesOf(client)).toEqual([{ account: 'snapie', weight: 300 }]);

    client = makeClient();
    await postSnapWithBeneficiaries(client as never, { ...base, hasHangout: true, hasAudio: true }, key);
    expect(beneficiariesOf(client)).toEqual([{ account: 'snapie', weight: 1000 }]);
});

it('merges chosen beneficiaries with @snapie, sorted by account', async () => {
    const client = makeClient();
    await postSnapWithBeneficiaries(
        client as never,
        { ...base, hasHangout: true, beneficiaries: [{ account: 'zed', weight: 500 }, { account: 'alice', weight: 1000 }] },
        key
    );
    expect(beneficiariesOf(client)).toEqual([
        { account: 'alice', weight: 1000 },
        { account: 'snapie', weight: 300 },
        { account: 'zed', weight: 500 },
    ]);
});

it('refuses to broadcast beneficiaries over 100%', async () => {
    const client = makeClient();
    await expect(
        postSnapWithBeneficiaries(client as never, { ...base, hasVideo: true, beneficiaries: [{ account: 'alice', weight: 9500 }] }, key)
    ).rejects.toThrow(/100%/);
    expect(client.broadcast.sendOperations).not.toHaveBeenCalled();
});

it('uses the caller’s @snapie share when given', async () => {
    const client = makeClient();
    await postSnapWithBeneficiaries(
        client as never,
        { ...base, hasHangout: true, hasAudio: true, snapieWeight: 300, beneficiaries: [{ account: 'alice', weight: 100 }] },
        key
    );
    expect(beneficiariesOf(client)).toEqual([
        { account: 'alice', weight: 100 },
        { account: 'snapie', weight: 300 },
    ]);
});
