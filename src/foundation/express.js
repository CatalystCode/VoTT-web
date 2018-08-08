module.exports = {
    replyWithError: function (res, error) {
        if (error.statusCode) {
            res.status(error.statusCode);
        }
        else {
            res.status(500);
        }
        res.send(error);
    }
};
