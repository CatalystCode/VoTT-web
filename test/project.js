const assert = require('assert');
const projectController = require('../src/project');

describe('Project graphql controller', () => {

  describe('#setServices()', () => {

    it('should initialize tables', () => {

      const createdTables = [];
      return projectController.setServices({
        tableService: {
          createTableIfNotExists: (tableName, callback) => {
            createdTables.push(tableName);
            callback();
          }
        }
      }).then(data => {
        assert.deepEqual(createdTables, ['images', 'projects']);
      });

    });

  });

});
