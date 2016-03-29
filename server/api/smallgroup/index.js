'use strict';

var express = require('express');
var controller = require('./smallgroup.controller');
var config = require('../../config/environment');
var auth = require('../../auth/auth.service');

var router = express.Router();

router.get('/', auth.isAuthenticated(), controller.index);

router.post('/', auth.hasRole('mentor'), controller.create);
router.put('/:id', auth.hasRole('mentor'), controller.modify);
router.put('/:id/name',auth.hasRole('mentor'),controller.changeName);
router.get('/:id/members', controller.getSmallGroupMembers);
router.put('/:id/member', controller.addMember);
router.get('/:id', auth.isAuthenticated(), controller.getSmallGroup);
router.put('/:id/name', auth.isAuthenticated(), controller.changeName);
router.delete('/:id', auth.hasRole('mentor') || auth.hasRole('admin'), controller.delete);
router.post('/:id/daycode', auth.hasRole('mentor') || auth.hasRole('admin'), controller.daycode);

module.exports = router;
