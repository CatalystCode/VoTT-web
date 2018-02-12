/**
 * InviteController
 *
 * @description :: Server-side logic for managing invites
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

    read: function (req, res) {
        const userId = req.params.userId;
        const inviteId = req.params.inviteId;
        Invite.findOne({ id: inviteId }).populate('user').exec(function (error, invite) {
            if (error) return res.serverError(error);
            if (!invite) return res.notFound();
            if (invite.user.id != userId) return res.notFound();

            const configuration = JWTService.getDefaultConfiguration();
            const token = JWTService.sign({ userId: userId }, configuration);
            const userAgent = req.headers['user-agent'];
            if (userAgent != null && userAgent.includes('vott')) {
                return res.cookie('token', token)
                    .status(200)
                    .send({ token: token });
            }

            res.cookie('token', token)
                .redirect('/vott/');
        });
    },

    logout: function (req, res) {
        res.clearCookie('token').ok();
    }

};

