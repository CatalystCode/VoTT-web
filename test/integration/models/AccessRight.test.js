const assert = require('assert');

describe('AccessRight', function () {

    describe('#find()', function () {
        it('should fetch existing records', function () {
            return AccessRight.find().then(rights => {
                assert.deepEqual(rights.length, 1);
            });
        });
    });

});
