const log = require('log')('app:volunteer');
const Router = require('koa-router');
const _ = require('lodash');
const auth = require('../auth/auth');
const service = require('./service');
const opportunityService = require('../opportunity/service');

var router = new Router();

router.post('/api/volunteer', auth, async (ctx, next) => {
  var task = await opportunityService.findById(ctx.request.body.taskId);
  if (await service.canAddVolunteer(ctx.request.body, ctx.state.user)) {
    var attributes = ctx.request.body;
    attributes.userId = ctx.state.user.id;
    await service.addVolunteer(ctx.state.user.tokenset, attributes, function (err, volunteer) {
      if (err) {
        return ctx.body = err;
      }
      if (volunteer.silent == null || volunteer.silent == 'false') {
        service.sendAddedVolunteerNotification(ctx.state.user, volunteer, 'volunteer.create.thanks');
        opportunityService.sendTaskAppliedNotification(ctx.state.user, task);
      }
      volunteer.name = ctx.state.user.name;
      return ctx.body = volunteer;
    });
  } else {
    ctx.status = 401;
    return ctx.body = null;
  }
});

router.get('/api/volunteer/user/resumes', auth, auth.checkToken, async (ctx, next) => {
  await service.getResumes(ctx.state.user).then(resumes => {
    ctx.status = 200;
    ctx.body = {
      key: ctx.state.user.tokenset.access_token,
      resumes: resumes,
    };
  }).catch(err => {
    ctx.status = 404;
  });
});

router.get('/api/volunteer/:id/resume', auth, auth.checkToken, async (ctx, next) => {
  await service.getVolunteerResumeAccess(ctx.state.user.tokenset, ctx.params.id, ctx.query.taskId).then(result => {
    ctx.status = 200;
    ctx.body = {
      key: ctx.state.user.tokenset.access_token,
      url: result,
    };
  }).catch(err => {
    ctx.status = 400;
  }); 
});

router.get('/api/volunteer/:id', auth, async (ctx, next) => {
  await service.getVolunteer(ctx.params.id,ctx.query.taskId).then(result => {
    ctx.body = result[0];
  }).catch(err => {
    ctx.status = 400;
  }); 
});

router.put('/api/volunteer/:id', auth, async (ctx, next) => {
  var attributes = ctx.request.body;
  attributes.id= ctx.params.id;
  attributes.updatedAt = new Date();
  await service.updateVolunteer(ctx.state.user.tokenset, attributes, async (errors, result) => {    
    if (errors) {
      ctx.status = 400;
      ctx.body = errors;
    } else {     
      ctx.status = 200;
      ctx.body = result;
    }
  }); 
});

router.post('/api/volunteer/delete', auth, async (ctx, next) => {
  var attributes = ctx.request.body;
  attributes.userId = ctx.state.user.id;
  await service.deleteVolunteer(attributes, function (notificationInfo, err) {
    if (!err) {
      service.sendDeletedVolunteerNotification(notificationInfo[0], 'volunteer.destroy.decline');
      ctx.status = 200;
      ctx.body = notificationInfo[0];
    } else {
      ctx.status = 400;
    }
  });
});

router.post('/api/volunteer/assign', auth, async (ctx, next) => {
  var task = await opportunityService.findById(ctx.request.body.taskId);

  if (await service.canManageVolunteers(ctx.request.body.taskId, ctx.state.user)) {
    await service.assignVolunteer(+ctx.request.body.volunteerId, ctx.request.body.assign, function (err, volunteer) {
      if (err) {
        ctx.status = 400;
        return ctx.body = err;
      }
      if (ctx.request.body.assign == 'true' && task.state == 'in progress') {
        opportunityService.sendTaskAssignedNotification(volunteer.assignedVolunteer, task);
      }
      ctx.status = 200;
      return ctx.body = volunteer;
    });
  } else {
    ctx.status = 401;
    return ctx.body = null;
  }
});

router.post('/api/volunteer/select', auth, async (ctx, next) => {
  var task = await opportunityService.findById(ctx.request.body.taskId);
  if (await service.canManageVolunteers(ctx.request.body.taskId, ctx.state.user)) {
    await service.selectVolunteer(+ctx.request.body.volunteerId,ctx.request.body.taskId, ctx.request.body.select, function (err, volunteer) {
      if (err) {
        ctx.status = 400;
        return ctx.body = err;
      }
      if (ctx.request.body.select == 'true' && task.state == 'in progress') {
        opportunityService.sendTaskAssignedNotification(volunteer.assignedVolunteer, task);
      }
      ctx.status = 200;
      return ctx.body = volunteer;
    });
  } else {
    ctx.status = 401;
    return ctx.body = null;
  }
});

router.put('/api/volunteer/select/remove', auth, async (ctx, next) => {
  var task = await opportunityService.findById(ctx.request.body.taskId);
  if (await service.canManageVolunteers(ctx.request.body.taskId, ctx.state.user)) {
    await service.selectVolunteer(+ctx.request.body.volunteerId,ctx.request.body.taskId, ctx.request.body.select, function (err, volunteer) {
      if (err) {
        ctx.status = 400;
        return ctx.body = err;
      } 
      ctx.status = 200;
      return ctx.body = volunteer;
    });
  } else {
    ctx.status = 401;
    return ctx.body = null;
  }
});


router.post('/api/volunteer/complete', auth, async (ctx, next) => {
  if (await service.canManageVolunteers(ctx.request.body.taskId, ctx.state.user)) {
    await service.volunteerComplete(+ctx.request.body.volunteerId, ctx.request.body.complete, function (err, volunteer) {
      if (err) {
        ctx.status = 400;
        return ctx.body = err;
      }
      ctx.status = 200;
      return ctx.body = volunteer;
    });
  } else {
    ctx.status = 401;
    return ctx.body = null;
  }
});

router.delete('/api/volunteer/:id', auth, async (ctx, next) => {
  if (await service.canManageVolunteers(ctx.query.taskId, ctx.state.user)) {
    await service.deleteVolunteer(+ctx.params.id, +ctx.query.taskId, function (notificationInfo, err) {
      if (!err) {
        service.sendDeletedVolunteerNotification(notificationInfo[0], 'volunteer.destroy.decline');
      } else {
        ctx.status = 400;
      }
      ctx.body = null;
    });
  } else {
    ctx.status = 401;
    return ctx.body = null;
  }
});

module.exports = router.routes();
