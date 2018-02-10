var sails = require('sails');

before(function (done) {
    // Increase the Mocha timeout so that Sails has enough time to lift.
    this.timeout(5000);

    process.env.SENDGRID_API_KEY = "test";
    process.env.VOTT_DEFAULT_ADMIN_EMAIL = "someone@example.com";
    process.env.VOTT_DEFAULT_ADMIN_NAME = "Bill";

    const configOverrides = {
        emailServiceEnabled: false,
        log: {
            level: 'debug',
            colorize: true
        },
        connections: {
            memory: {
                adapter: 'sails-disk',
                inMemoryOnly: true
            }
        },
        models: {
            connection: 'memory',
            migrate: 'drop'
        }
    };
    sails.load(configOverrides, function (err) {
        if (err) return done(err);
        done(err, sails);
    });
});

after(function (done) {
    sails.lower(done);
});
