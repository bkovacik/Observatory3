'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var crypto = require('crypto');
var md5 = require('MD5');
var Commit = require('../commit/commit.model');
var ClassYear = require('../classyear/classyear.model');
var Project = require('../project/project.model');

var UserSchema = new Schema({
  name: String,
  email: { type: String, lowercase: true },
  active: {type: Boolean, default: true},
  role: {
    type: String,
    default: 'user'
  },
  smallgroup: {type : Schema.Types.ObjectId, ref: 'SmallGroup'},
  hashedPassword: String,
  provider: String,
  salt: String,
  tech: [String],
  projects: [{type : Schema.Types.ObjectId, ref: 'Project'}], // project id
  bio: {type:String},
  attendance: [Date],
  unverifiedAttendance: [Date],
  semesterCount: Number,
  passwordResetToken: String,
  passwordResetExpiration: Date,


  // field for what user is currently enrolled as (pay, credit, experience)
  rcosStyle: String,

  github: {
    events: [{
      type: String,
      action: String,
      message: String,
      url: String,
      date: Date
    }],
    login: {type: String, lowercase: true},
    profile: String,
  }

});

/**
 * Virtuals
 */
UserSchema
  .virtual('password')
  .set(function(password) {
    this._password = password;
    this.salt = this.makeSalt();
    this.hashedPassword = this.encryptPassword(password);
  })
  .get(function() {
    return this._password;
  });

/**
* Get gravatar url
*
* @return {String}
* @api public
*/
var makeAvatar = function(email) {
  if (email){
    return '//www.gravatar.com/avatar/'+md5(email.trim().toLowerCase())+"?d=identicon";
  }
  return  '//www.gravatar.com/avatar/00000000000000000000000000000000+"?d=identicon"';

};

UserSchema
  .virtual('avatar')
  .get(function(){
    return makeAvatar(this.email) ;
});


function isoDateToTime(isoDate){
  var date = new Date(isoDate);
  date.setHours(0,0,0,0);
  return date.getTime();
}

// Represents a users attendance on a given day
UserSchema
  .virtual('presence')
  .get(function(){
    var today = new Date();
    today.setHours(0,0,0,0);

    for (var i = 0;i < this.attendance.length;i++){
      if (isoDateToTime(this.attendance[i]) == today.getTime()){
        return "present";
      }
    }
    for (var i = 0;i < this.unverifiedAttendance.length;i++){
      if (isoDateToTime(this.unverifiedAttendance[i]) == today.getTime()){
        return "unverified";
      }
    }
    return "absent";
  })
  .set(function(status){
    var today = new Date();
    today.setHours(0,0,0,0);
    if (status === "present"){
      // Make sure user is not unverified for today
      for (var i = this.unverifiedAttendance.length-1;i >= 0;i--){
        if (isoDateToTime(this.unverifiedAttendance[i]) == today.getTime()){
           this.unverifiedAttendance.splice(i,1);
        }
      }

      // If user already has attendance don't change anything
      for (var i = 0;i < this.attendance.length;i++){
        if (isoDateToTime(this.attendance[i]) == today.getTime()){
          return;
        }
      }
      this.attendance.push(today);
    }else if (status === "unverified"){
      // If user already has attendance remove their attendance
      for (var i = this.attendance.length-1;i >= 0;i--){
        if (isoDateToTime(this.attendance[i]) == today.getTime()){
          this.attendance.splice(i,1);
        }
      }

      // See if user already is unverifed
      for (var i = 0;i < this.unverifiedAttendance.length;i++){
        if (isoDateToTime(this.unverifiedAttendance[i]) == today.getTime()){
          return;
        }
      }

      this.unverifiedAttendance.push(today);
    }else if (status === "absent"){
      // Remove attendance from unverified and attendance
      for (var i = this.attendance.length-1;i >= 0;i--){
        if (isoDateToTime(this.attendance[i]) == today.getTime()){
          this.attendance.splice(i,1);
        }
      }
      for (var i = this.unverifiedAttendance.length-1;i >= 0;i--){
        if (isoDateToTime(this.unverifiedAttendance[i]) == today.getTime()){
           this.unverifiedAttendance.splice(i,1);
        }
      }
    }
    this.save();
  });

// Public profile information
// TODO this is redundant with getFullProfile- can it be deleted?
UserSchema
  .virtual('profile')
  .get(function() {
    var twoWeeks = new Date();
    twoWeeks.setDate(twoWeeks.getDate()-14);
    return {
      '_id':this._id.toString('binary'),
      'name': this.name,
      'role': this.role,
      'avatar': this.avatar,
      'email': this.email,
      'semesters': this.semesterCount,
      'attendance': this.attendance,
      "attendanceScore": 0,
      "attendanceBonus": 0,
      'projects': this.projects,
      'tech': this.tech,
      'bio': this.bio,
      'githubProfile': this.github.login
    };
  });

// User list information
UserSchema
  .virtual('stats')
  .get(function() {
    var data = this.toObject();
    data.avatar = this.avatar;
    data.attendance = 0;
    delete data.hashedPassword ;
    delete data.salt ;
  return data;
});

// User list information
UserSchema
  .virtual('listInfo')
  .get(function() {
    return {
      '_id':this._id.toString('binary'),
      'name': this.name,
      'role': this.role,
      'avatar': this.avatar,
      'githubProfile': this.github.login,
    };
  });

// Non-sensitive info we'll be putting in the token
UserSchema
  .virtual('token')
  .get(function() {
    return {
      '_id': this._id,
      'role': this.role
    };
  });

// Helper Virtual for isAdmin
UserSchema
  .virtual('isAdmin')
  .get(function(){
      return this.role == 'admin';
  });

// Helper Virtual for isAdmin
UserSchema
  .virtual('isMentor')
  .get(function(){
    return this.role == 'admin' || this.role == 'mentor';
  });

/**
 * Validations
 */

// Validate empty email
UserSchema
  .path('email')
  .validate(function(email) {
    return email.length;
  }, 'Email cannot be blank');

// Validate empty password
UserSchema
  .path('hashedPassword')
  .validate(function(hashedPassword) {
    return hashedPassword.length;
  }, 'Password cannot be blank');

// Validate email is not taken
UserSchema
  .path('email')
  .validate(function(value, respond) {
    var self = this;
    this.constructor.findOne({email: value}, function(err, user) {
      if(err) throw err;
      if(user) {
        if(self.id === user.id) return respond(true);
        return respond(false);
      }
      respond(true);
    });
}, 'The specified email address is already in use.');

var validatePresenceOf = function(value) {
  return value && value.length;
};

/**
 * Pre-save hook
 */
UserSchema
  .pre('save', function(next) {
    if (!this.isNew) return next();

    if (!validatePresenceOf(this.hashedPassword))
      next(new Error('Invalid password'));
    else
      next();
  });


function loadUserProjects(user, callback){
    // If the user doesn't have any projects, return
    if (user.projects.length == 0){
        return callback([]);
    }
    // Otherwise load all the user projects
    var fullProjects = [];
    var loadedProjects = 0;
    for (var i = 0;i < user.projects.length;i++){
        Project.findById(user.projects[i], function(err, project){
            loadedProjects ++;
            if (!err) fullProjects.push(project);
            if (loadedProjects == user.projects.length){
                return callback(fullProjects);
            }
        });
    }
}

/**
 * Methods
 */
UserSchema.methods = {
  /**
   * Authenticate - check if the passwords are the same
   *
   * @param {String} plainText
   * @return {Boolean}
   * @api public
   */
  authenticate: function(plainText) {
    return this.encryptPassword(plainText) === this.hashedPassword;
  },

  /**
   * Return true if the reset token is valid for this user
   *
   * @param {String} token
   * @return {Boolean}
   */
  validResetToken: function(token){
    return this.passwordResetToken === token && new Date() < this.passwordResetExpiration;
  },

  /**
   * Make salt
   *
   * @return {String}
   * @api public
   */
  makeSalt: function() {
    return crypto.randomBytes(16).toString('base64');
  },

  /**
   * Encrypt password
   *
   * @param {String} password
   * @return {String}
   * @api public
   */
  encryptPassword: function(password) {
    if (!password || !this.salt) return '';
    var salt = new Buffer(this.salt, 'base64');
    return crypto.pbkdf2Sync(password, salt, 10000, 64).toString('base64');
  },

  /**
   * Gets the full user profile (includes full projects, instead of just ids)
   *
   * @param {Function(JSON)} callback - Called when all full profile properties
   *        have been loaded
   * @api public
   */
  getFullProfile: function(callback){
     var user = this;
     loadUserProjects(user, function(fullProjects){
         callback({
           '_id': user._id.toString('binary'),
           'name': user.name,
           'role': user.role,
           'avatar': user.avatar,
           'email': user.email,
           'semesters': user.semesterCount,
           'projects': fullProjects,
           'tech': user.tech,
           'bio': user.bio,
           'githubProfile': user.github.login
       });
     });
  }
};


module.exports = mongoose.model('User', UserSchema);
