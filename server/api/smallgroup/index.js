'use strict';

var express = require('express');
var controller = require('./smallgroup.controller');
var config = require('../../config/environment');
var auth = require('../../auth/auth.service');

var router = express.Router();

// Basic Access / Manipulation
router.get('/', auth.hasRole('mentor'), controller.index);
router.post('/', auth.hasRole('mentor'), controller.create);
router.put('/:id', auth.hasRole('mentor'), controller.modify);
router.delete('/:id', auth.hasRole('mentor'), controller.delete);
router.get('/:id', auth.isAuthenticated(), controller.getSmallGroup);

// Generate a daycode or return the current day code for the smallgroups
router.post('/:id/daycode', auth.hasRole('mentor'), controller.daycode);

// Access / Manipulate the members of a smallgroup
router.get('/:id/members', auth.isAuthenticated(), controller.getSmallGroupMembers);
router.put('/:id/member', auth.hasRole('mentor'), controller.addMember);
router.delete('/:id/member/:memberId', auth.hasRole('mentor'), controller.deleteMember);

// Change the smallgroup name
router.put('/:id/name', auth.hasRole('mentor'), controller.changeName);

module.exports = router;
