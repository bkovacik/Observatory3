'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var crypto = require('crypto');
var md5 = require('MD5');
var Commit = require('../commit/commit.model');
var ClassYear = require('../classyear/classyear.model');
var Project = require('../project/project.model');

var attendanceSchema = new Schema({

    year: Schema.Types.ObjectId,
    verified: [{
        date:Date,
        bonusDay:Boolean,
        smallgroup:Boolean
    }],
    unverified: [{
        date:Date,
        bonusDay:Boolean,
        smallgroup:Boolean
    }]

});

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
  attendanceByYear: [attendanceSchema ],
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
    return 'http://www.gravatar.com/avatar/'+md5(email.trim().toLowerCase())+"?d=identicon";
  }
  return  'http://www.gravatar.com/avatar/00000000000000000000000000000000+"?d=identicon"';

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
        var classYear = global.currentClassYear;
        if (!'attendanceByYear' in this || this.attendanceByYear == undefined){
            return 'absent';
        }

        for (var i = this.attendanceByYear.length-1; i>=0; i--){
            if (this.attendanceByYear[i].year.equals(classYear._id)){

                var thisYear = this.attendanceByYear[i];
                for (var a = thisYear.verified.length-1; a>= 0 ; a--){
                  if (isoDateToTime(thisYear.verified[a].date) === isoDateToTime(today)){
                    var thisDate = thisYear.verified[a];
                    if (!thisDate.bonusDay && !thisDate.smallgroup){
                        return 'present';
                    }
                  }
                }
                for (var a = thisYear.unverified.length-1; a>= 0 ; a--){
                  if (isoDateToTime(thisYear.unverified[a].date) === isoDateToTime(today)){
                    var thisDate = thisYear.unverified[a];
                    if (!thisDate.bonusDay && !thisDate.smallgroup){
                        return 'unverified';
                    }
                  }
                }
                return 'absent';
            }
        }

        return 'absent';
    })
    .set(function(status){
        var today = new Date();
        if (!'attendanceByYear' in this || this.attendanceByYear == undefined){
            this.attendanceByYear = [];
        }
        //New style attendence
        var classYear = global.currentClassYear;
            //Find the year
            var foundYear = false;
            for (var i = this.attendanceByYear.length-1; i>=0 ; i--){
                if (this.attendanceByYear[i].year.equals(classYear._id)){
                    foundYear = true;
                    var thisYear = this.attendanceByYear[i];

                    if (status === 'present' || status === 'presentSmall' || status === 'presentBonus'){

                        // Check if user is unverified for today
                        for (var a = thisYear.unverified.length-1; a>= 0 ; a--){
                          if (isoDateToTime(thisYear.unverified[a].date) === isoDateToTime(today)){

                            var thisDate = thisYear.unverified[a];
                            var found = false;
                            if (status === 'present' && thisDate.bonus === false && thisDate.smallgroup === false){
                                found = true;
                            }
                            if (status === 'presentSmall' && thisDate.bonus === false && thisDate.smallgroup === true){
                                found = true;
                            }
                            if (status === 'presentBonus' && thisDate.bonus === true && thisDate.smallgroup === false){
                                found = true;
                            }
                            if (found){
                                thisYear.unverified[a].splice(a,1);
                                thisYear.verified.push(thisDate);
                                this.attendanceByYear[i]=thisYear;
                                // this.attendanceByYear[i].verified.set()
                                this.markModified("attendanceByYear");
                                thisYear.save();
                                return;
                            }
                          }
                        }

                        // Check if user is already verified for today
                        for (var a = thisYear.verified.length-1; a>= 0 ; a--){

                          if (isoDateToTime(thisYear.verified[a].date) === isoDateToTime(today)){

                            var thisDate = thisYear.verified[a];
                            var found = false;
                            if (status === 'present' && thisDate.bonus === false && thisDate.smallgroup === false){
                                found = true;
                            }
                            if (status === 'presentSmall' && thisDate.bonus === false && thisDate.smallgroup === true){
                                found = true;
                            }
                            if (status === 'presentBonus' && thisDate.bonus === true && thisDate.smallgroup === false){
                                found = true;
                            }
                            if (found){
                                return;
                            }
                          }

                        }
                        if (status === 'present'){
                            thisYear.verified.push({
                                date:today,
                                bonusDay:false,
                                smallgroup:false
                            });
                        }
                        else if (status === 'presentSmall'){
                            thisYear.verified.push({
                                date:today,
                                bonusDay:false,
                                smallgroup:true
                            });
                        }
                        else if (status === 'presentBonus'){
                            thisYear.verified.push({
                                date:today,
                                bonusDay:true,
                                smallgroup:false
                            });
                        }

                        this.markModified("attendanceByYear");
                        this.save();
                        return;
                    }
                    else if (status === 'unverified' || status === 'unverifiedBonus' || status === 'unverifiedSmall'){
                        // Check if user is verified for today
                        for (var a = thisYear.verified.length-1; a>= 0 ; a--){
                          if (isoDateToTime(thisYear.verified[a].date) === isoDateToTime(today)){
                            var thisDate = thisYear.verified[a];
                            var found = false;
                            if (status === 'unverified' && thisDate.bonus === false && thisDate.smallgroup === false){
                                found = true;
                            }
                            if (status === 'unverifiedSmall' && thisDate.bonus === false && thisDate.smallgroup === true){
                                found = true;
                            }
                            if (status === 'unverifiedBonus' && thisDate.bonus === true && thisDate.smallgroup === false){
                                found = true;
                            }
                            if (found){
                                thisYear.verified[a].splice(a,1);
                                thisYear.unverified.push(thisDate);
                                this.markModified("attendanceByYear");
                                thisYear.save();
                                return;
                            }
                          }
                        }
                        // Check if user is already unverified for today
                        for (var a = thisYear.unverified.length-1; a>= 0 ; a--){
                          if (isoDateToTime(thisYear.unverified[a].date) === isoDateToTime(today)){
                            var thisDate = thisYear.unverified[a];
                            var found = false;
                            if (status === 'unverified' && thisDate.bonus === false && thisDate.smallgroup === false){
                                found = true;
                            }
                            if (status === 'unverifiedSmall' && thisDate.bonus === false && thisDate.smallgroup === true){
                                found = true;
                            }
                            if (status === 'unverifiedBonus' && thisDate.bonus === true && thisDate.smallgroup === false){
                                found = true;
                            }
                            if (found){
                                return;
                            }
                          }
                        }
                        if (status === 'unverified'){
                            thisYear.unverified.push({
                                date:today,
                                bonusDay:false,
                                smallgroup:false
                            });
                        }
                        else if (status === 'unverifiedSmall'){
                            thisYear.unverified.push({
                                date:today,
                                bonusDay:false,
                                smallgroup:true
                            });
                        }
                        else if (status === 'unverifiedBonus'){
                            thisYear.unverified.push({
                                date:today,
                                bonusDay:true,
                                smallgroup:false
                            });
                        }
                        this.markModified("attendanceByYear");
                        this.save();
                        return;
                    }
                    else if (status === 'absent' || status === 'absentBonus' || status === 'absentSmall'){
                        // Check if user is verified for today
                        for (var a = thisYear.verified.length-1; a>= 0 ; a--){
                          if (isoDateToTime(thisYear.verified[a].date) === isoDateToTime(today)){
                            var thisDate = thisYear.verified[a];
                            var found = false;
                            if (status === 'unverified' && thisDate.bonus === false && thisDate.smallgroup === false){
                                found = true;
                            }
                            if (status === 'unverifiedSmall' && thisDate.bonus === false && thisDate.smallgroup === true){
                                found = true;
                            }
                            if (status === 'unverifiedBonus' && thisDate.bonus === true && thisDate.smallgroup === false){
                                found = true;
                            }
                            if (found){
                                thisYear.verified[a].splice(a,1);
                            }
                          }
                        }
                        // Check if user is unverified for today
                        for (var a = thisYear.unverified.length-1; a>= 0 ; a--){
                          if (isoDateToTime(thisYear.unverified[a].date) === isoDateToTime(today)){
                            var thisDate = thisYear.unverified[a];
                            var found = false;
                            if (status === 'present' && thisDate.bonus === false && thisDate.smallgroup === false){
                                found = true;
                            }
                            if (status === 'presentSmall' && thisDate.bonus === false && thisDate.smallgroup === true){
                                found = true;
                            }
                            if (status === 'presentBonus' && thisDate.bonus === true && thisDate.smallgroup === false){
                                found = true;
                            }
                            if (found){
                                thisYear.unverified[a].splice(a,1);
                            }
                          }
                        }
                        this.markModified("attendanceByYear");
                        thisYear.save();
                        return;
                    }
                }
            }
            if (!foundYear){
                var AttendanceModel = mongoose.model('Attendance', attendanceSchema)
                var newYear = new AttendanceModel({
                    year : classYear._id,
                    verified : [],
                    unverified: []
                });
                if (status === 'present'){
                    newYear.verified.push({
                        date:today,
                        bonusDay:false,
                        smallgroup:false
                    });
                }
                else if (status === 'presentSmall'){
                    newYear.verified.push({
                        date:today,
                        bonusDay:false,
                        smallgroup:true
                    });
                }
                else if (status === 'presentBonus'){
                    newYear.verified.push({
                        date:today,
                        bonusDay:true,
                        smallgroup:false
                    });
                }
                if (status === 'unverified'){
                    newYear.unverified.push({
                        date:today,
                        bonusDay:false,
                        smallgroup:false
                    });
                }
                else if (status === 'unverifiedSmall'){
                    newYear.unverified.push({
                        date:today,
                        bonusDay:false,
                        smallgroup:true
                    });
                }
                else if (status === 'unverifiedBonus'){
                    newYear.unverified.push({
                        date:today,
                        bonusDay:true,
                        smallgroup:false
                    });
                }
                this.attendanceByYear.push(newYear);
                this.markModified("attendanceByYear");
                this.save();
            }
    });
UserSchema
    .virtual('presenceSmall')
    .get(function(){
        var today = new Date();
        today.setHours(0,0,0,0);
        if (!'attendanceByYear' in this || this.attendanceByYear == undefined){
            return 'absentSmall';
        }
        var classYear = global.currentClassYear;
            for (var i = this.attendanceByYear.length-1; i>=0; i--){
                if (this.attendanceByYear[i].year.equals(classYear._id)){
                    var thisYear = this.attendanceByYear[i];
                    for (var a = thisYear.verified.length-1; a>= 0 ; a--){
                      if (isoDateToTime(thisYear.verified[a].date) === isoDateToTime(today)){
                        var thisDate = thisYear.verified[a];

                        if(thisDate.smallgroup){
                            return 'presentSmall';
                        }

                      }
                    }
                    for (var a = thisYear.unverified.length-1; a>= 0 ; a--){
                      if (isoDateToTime(thisYear.unverified[a].date) === isoDateToTime(today)){
                        var thisDate = thisYear.unverified[a];

                        if(thisDate.smallgroup){
                            return 'unverifiedSmall';
                        }

                      }
                    }
                }
            }
            return 'absentSmall';
    })
    .set(function(status){
        if (status === 'unverified'){
            this.presence = 'unverifiedSmall';
            return;
        }
        if (status === 'present'){
            this.presence = 'presentSmall';
            return;
        }
        this.presence = status;

    });

UserSchema
    .virtual('presenceBonus')
    .get(function(){
        var today = new Date();
        today.setHours(0,0,0,0);
        if (!'attendanceByYear' in this || this.attendanceByYear == undefined){
            return 'absentBonus';
        }

        var classYear = global.currentClassYear;
            for (var i = this.attendanceByYear.length-1; i>=0; i--){
                if (this.attendanceByYear[i].year.equals(classYear._id)){
                    var thisYear = this.attendanceByYear[i];
                    for (var a = thisYear.verified.length-1; a>= 0 ; a--){
                      if (isoDateToTime(thisYear.verified[a].date) === isoDateToTime(today)){
                        var thisDate = thisYear.verified[a];

                        if(thisDate.bonus){
                            return 'presentBonus';
                        }

                      }
                    }
                    for (var a = thisYear.unverified.length-1; a>= 0 ; a--){
                      if (isoDateToTime(thisYear.unverified[a].date) === isoDateToTime(today)){
                        var thisDate = thisYear.unverified[a];

                        if(thisDate.bonus){
                            return 'unverifiedBonus';
                        }

                      }
                    }
                }
            }
            return 'absentBonus'
    })
    .set(function(status){
        if (status === 'unverified'){
            this.presence = 'unverifiedBonus';
            return;
        }
        if (status === 'present'){
            this.presence = 'presentBonus';
            return;
        }
        this.presence = status;

    });

// Public profile information
UserSchema
  .virtual('profile')
  .get(function() {
    return {
      '_id':this._id.toString('binary'),
      'name': this.name,
      'role': this.role,
      'active': this.active,
      'avatar': this.avatar,
      'semesters': this.semesterCount,
      'projects': this.projects,
      'tech': this.tech,
      'bio': this.bio,
      'githubProfile': this.github.login
    };
  });

 UserSchema
   .virtual('privateProfile')
   .get(function() {
     return {
       '_id':this._id.toString('binary'),
       'name': this.name,
       'email': this.email,
       'active': this.active,
       'role': this.role,
       'smallgroup': this.smallgroup,
       'tech': this.tech,
       'avatar': this.avatar,
       'projects': this.projects,
       'bio': this.bio,
       'attendanceByYear': this.attendanceByYear,
       'attendance': this.attendance,
       'unverifiedAttendance': this.unverifiedAttendance,
       'semesters': this.semesterCount,
       'rcosStyle': this.rcosStyle,
       'githubProfile': this.github.login
     };
   });

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
            if (loadedProjects == fullProjects.length){
                callback(fullProjects);
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
           'attendance': user.attendance,
           'projects': fullProjects,
           'tech': user.tech,
           'bio': user.bio,
           'githubProfile': user.github.login
       });
     });
  },

  getCurrentAttendance: function(callback){
    var user = this;
    ClassYear.findOne({
        "current": true
    })
    .exec(function (err, classYear) {
        if(err) { return res;}
        var res = {};
        res.totalDates = classYear.dates;
        res.totalBonusDates = classYear.bonusDates;

        res.currentAttendance = user.attendance.filter(function(value){
            for (var i = 0;i < res.totalDates.length;i++){
                if (res.totalDates[i].getTime() === value.getTime()){
                    return true;
                }
            }
            return false;
        });
        res.currentBonusAttendance = res.currentAttendance.filter(function(value){
            for (var i = 0;i < res.totalBonusDates.length;i++){
                if (res.totalBonusDates[i].getTime() === value.getTime()){

                    return true;
                }
            }
            return false;
        });


        if (!'attendanceByYear' in user || user.attendanceByYear == undefined){
            user.attendanceByYear = [];
        }
        for (var i = user.attendanceByYear.length-1; i>=0 ; i--){
            if (user.attendanceByYear[i].year.equals(classYear._id)){
                res.currentAttendance = res.currentAttendance.concat(user.attendanceByYear[i].verified.filter(function(value){
                    return !value.bonusDay && !value.smallgroup;
                }).map(function(value){
                    return value.date;
                }));

                res.currentBonusAttendance = res.currentBonusAttendance.concat(user.attendanceByYear[i].verified.filter(function(value){
                    return value.bonusDay && !value.smallgroup;
                }).map(function(value){
                    return value.date;
                }));
                break;
            }
        }

        if (user.smallgroup){
            res.totalSmallDates = user.smallgroup.dates;
            res.smallgroup = user.smallgroup.name;
            res.currentSmallAttendance = user.attendance.filter(function(value){
                for (var i = 0;i < res.totalSmallDates.length;i++){
                    if (res.totalSmallDates[i].getTime() === value.getTime()){
                        return true;
                    }
                }
                return false;
            });
            for (var i = user.attendanceByYear.length-1; i>=0 ; i--){
                if (user.attendanceByYear[i].year.equals(classYear._id)){
                    res.currentSmallAttendance = res.currentSmallAttendance.concat(user.attendanceByYear[i].verified.filter(function(value){
                        return !value.bonusDay && value.smallgroup;
                    }).map(function(value){
                        return value.date;
                    }));
                    break;
                }
            }

        }
        else{
            res.totalSmallDates = [];
            res.currentSmallAttendance = [];
        }
        callback(res);
    });
  }
};



module.exports = mongoose.model('User', UserSchema);
