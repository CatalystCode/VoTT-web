const assert = require('assert');
const foundation = require('../src/vott-foundation');

describe('vott-foundation', () => {

  describe('#rectIntersection()', () => {

    it('should be undefined for disjoint rects', () => {
      const a = { x: 10, y: 20, width: 320, height: 200 };
      const b = { x: 640, y: 480, width: 10, height: 20 };

      const intersectionAB = foundation.rectIntersection(a, b);
      assert.equal(intersectionAB, undefined);

      const intersectionBA = foundation.rectIntersection(b, a);
      assert.equal(intersectionBA, undefined);
    });

    it('should equal for identical rects', () => {
      const a = { x: 10, y: 20, width: 320, height: 200 };

      const intersection = foundation.rectIntersection(a, a);
      assert.deepEqual(intersection, a);
    });

    it('should equal inner rect for nested rects', () => {
      const a = { x: 10, y: 20, width: 320, height: 200 };
      const b = { x: 15, y: 30, width: 64, height: 128 };

      const intersection = foundation.rectIntersection(a, b);
      assert.deepEqual(intersection, b);
    });

    it('should equal meaningful rect for intersecting rects', () => {
      const a = { x: 10, y: 20, width: 320, height: 200 };
      const b = { x: 320, y: 200, width: 640, height: 480 };

      const intersection = foundation.rectIntersection(a, b);
      assert.deepEqual(intersection, { x: 320, y: 200, width: 10, height: 20 });
    });

  }); /* #rectIntersection() */

  describe('#rectUnion()', () => {

    it('should be super rect for disjoint rects', () => {
      const a = { x: 0, y: 0, width: 50, height: 60 };
      const b = { x: 100, y: 200, width: 10, height: 20 };

      const intersectionAB = foundation.rectUnion(a, b);
      assert.deepEqual(intersectionAB, { x: 0, y: 0, width: 110, height: 220 });

      const intersectionBA = foundation.rectUnion(b, a);
      assert.deepEqual(intersectionBA, { x: 0, y: 0, width: 110, height: 220 });
    });

    it('should equal for identical rects', () => {
      const a = { x: 10, y: 20, width: 320, height: 200 };

      const union = foundation.rectUnion(a, a);
      assert.deepEqual(union, a);
    });

    it('should equal outer rect for nested rects', () => {
      const a = { x: 10, y: 20, width: 320, height: 200 };
      const b = { x: 15, y: 30, width: 64, height: 128 };

      const union = foundation.rectUnion(a, b);
      assert.deepEqual(union, a);
    });

    it('should equal meaningful rect for intersecting rects', () => {
      const a = { x: 10, y: 20, width: 320, height: 200 };
      const b = { x: 320, y: 200, width: 640, height: 480 };

      const intersection = foundation.rectUnion(a, b);
      assert.deepEqual(intersection, { x: 10, y: 20, width: 950, height: 660 });
    });

  });

  describe('#rectAnalysis()', () => {

    it('should work on empty lists', () => {
      const analysis = foundation.rectAnalysis([], []);
      assert.deepEqual(analysis.matches, []);
      assert.deepEqual(analysis.mismatches, []);
    });

    it('should return all mismatches', () => {
      const rectanglesA = [{ x: 10, y: 20, width: 320, height: 200 }, { x: 10, y: 20, width: 320, height: 200 }];
      const rectanglesB = [];

      const analysisAB = foundation.rectAnalysis(rectanglesA, rectanglesB);
      assert.deepEqual(analysisAB.matches, []);
      assert.deepEqual(analysisAB.mismatches, rectanglesA);

      const analysisBA = foundation.rectAnalysis(rectanglesB, rectanglesA);
      assert.deepEqual(analysisBA.matches, []);
      assert.deepEqual(analysisBA.mismatches, rectanglesA);
    });

    it('should return all matches', () => {
      const rectangles = [{ x: 10, y: 20, width: 320, height: 200 }, { x: 10, y: 20, width: 320, height: 200 }];
      const analysis = foundation.rectAnalysis(rectangles, rectangles);
      assert.deepEqual(analysis.matches, rectangles);
      assert.deepEqual(analysis.mismatches, []);
    });

    it('should return some matches and some mismatches', () => {
      const rectanglesA = [{ x: 10, y: 20, width: 320, height: 200 }, { x: 100, y: 200, width: 320, height: 200 }];
      const rectanglesB = [{ x: 20, y: 30, width: 320, height: 200 }, { x: 640, y: 480, width: 320, height: 200 }];

      const analysisAB = foundation.rectAnalysis(rectanglesA, rectanglesB);
      assert.deepEqual(analysisAB.matches, [{ x: 20, y: 30, width: 320, height: 200 }]);
      assert.deepEqual(analysisAB.mismatches, [{ x: 640, y: 480, width: 320, height: 200 }]);

      const analysisBA = foundation.rectAnalysis(rectanglesB, rectanglesA);
      assert.deepEqual(analysisBA.matches, [{ x: 10, y: 20, width: 320, height: 200 }]);
      assert.deepEqual(analysisBA.mismatches, [{ x: 100, y: 200, width: 320, height: 200 }]);
    });

  });


});
