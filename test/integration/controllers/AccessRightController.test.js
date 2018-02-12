var request = require('supertest');

describe('AccessRightController', function () {

    describe('#find()', function () {
        it('should respond with unauthorized', function (done) {
            request(sails.hooks.http.app)
                .get('/api/vott/v1/accessRights?projectId=a5c931ca-88af-455d-a9e9-b87ba46ede31')
                .expect(403, done);
        });
    });

});
