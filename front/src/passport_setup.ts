///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/passport/passport.d.ts'/>
///<reference path='typedefs/passport-google.d.ts'/>
///<reference path='typedefs/easy-no-password.d.ts'/>
///<reference path='typedefs/mailgun.d.ts'/>
///<reference path='typedefs/iuser.ts'/>

import Passport = require("passport");
import Config = require("./config");
import EasyNoPassword = require("easy-no-password");
import GoogleOAuth = require("passport-google-oauth");
import Mailgun = require("mailgun-js");
import Persona = require("passport-persona");
import User = require("./user_model");

var baseUrl = Config.url.protocol + "://" + Config.url.hostname
	+ ":" + Config.url.port + "/";
var googCallbackUrl = baseUrl + "auth/google/callback";

var mailgun = Mailgun({
	apiKey: Config.mailgun.api_key,
	domain: Config.mailgun.domain
});

function findOrCreateUser(email:string, profile:any,
		done:(err:Error, user?:IUser)=>void) {
	User.findOne({
		email: email
	}, (err, user) => {
		if (err) {
			return done(err);
		}

		if (user) {
			// Returning user
			console.log("Returning User", user.consoleText);
			done(null, user);

		} else {
			// Make a new user
			console.log("Creating New User");
			User.create({
				email: email,
				profile: profile
			}, (err, user) => {
				console.log("New User", user.consoleText);
				done(err, user);
			});
		}
	});
}

var googleStrategy = new (GoogleOAuth.OAuth2Strategy)({
		callbackURL: googCallbackUrl,
		clientID: Config.google.oauth_key,
		clientSecret: Config.google.oauth_secret
	},
	function (accessToken, refreshToken, profile, done) {
		console.log("Google Login", profile.emails[0].value);
		findOrCreateUser(profile.emails[0].value, profile._json, done);
	});	

var personaStrategy = new (Persona.Strategy)({
		audience: baseUrl
	},
	function (email, done) {
		console.log("Persona Callback", email);
		findOrCreateUser(email, { method: "persona" }, done);
	});

var easyStrategy = new (EasyNoPassword.Strategy)({
		secret: Config.easy.secret
	},
	function (email, token, done) {
		var url = `${baseUrl}auth/tok?u=${encodeURIComponent(email)}&t=${token}`;
		mailgun.messages().send({
			from: "Octave Online <webmaster@octave-online.net>",
			to: email,
			subject: "Octave Online Login",
			text: `Thanks for using Octave Online.  Your login token is: ${token}\n\nYou can also click the following link.\n\n${url}\n\nMore Info: When you want to sign in to Octave Online, you will receive an email with your token.  This eliminates the need for you to create and remember a password for Octave Online.`
		}, (err, info) => {
			if (err) {
				console.error("Failed sending email:", email, info);
			}
			done(null);
		});
	},
	function (email, done) {
		console.log("Easy Callback", email);
		findOrCreateUser(email, { method: "easy" }, done);
	});

module PassportSetup {
	export function init(){
		Passport.use(googleStrategy);
		Passport.use(personaStrategy);
		Passport.use(easyStrategy);
		Passport.serializeUser((user, cb) => {
			cb(null, user.id);
		});
		Passport.deserializeUser((user, cb) => {
			User.findById(user, cb);
		});

		console.log("Initialized Passport");
	}
}

export = PassportSetup