import { hideComments } from '../hideComments';

type C = { id: string; replies?: C[] };
const c = (id: string, replies?: C[]): C => ({ id, replies });
const ids = (list: C[]): unknown => list.map(x => (x.replies?.length ? [x.id, ids(x.replies)] : x.id));

it("drops hidden comments but keeps their replies, moved up into their place", () => {
    const tree = [c('a', [c('game', [c('human1'), c('human2', [c('deep')])])]), c('b')];
    expect(ids(hideComments(tree, x => x.id === 'game'))).toEqual([['a', ['human1', ['human2', ['deep']]]], 'b']);
});

it('hides nested hidden replies too, and leaves an untouched tree as it was', () => {
    const tree = [c('a', [c('x', [c('x')])])];
    expect(ids(hideComments(tree, x => x.id === 'x'))).toEqual(['a']);
    expect(ids(hideComments(tree, () => false))).toEqual([['a', [['x', ['x']]]]]);
});
