var helper = require("./date");
const express = require("express");
const bodyParser = require("body-parser");

const dotenv = require("dotenv");
dotenv.config();

const app = express();
app.use(express.static(__dirname + "/public"));
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");
var findOrCreate = require("mongoose-findorcreate");

mongoose.connect(process.env.DB_MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});

const expressSession = require("express-session");
const MongoStore = require("connect-mongo")(expressSession);

app.use(
  expressSession({
    secret: process.env.DB_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({
      mongooseConnection: mongoose.connection,
    }),
  })
);

app.set("view engine", "ejs");

app.listen(process.env.PORT || 3000, function () {
  console.log("Server Running at 3000 port");
});

const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
if (!fs.existsSync("./public/uploads")) {
  fs.mkdirSync("./public/uploads");
}

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fieldSize: 1024 * 1024 * 3,
  },
});

app.use("/uploads", express.static("uploads"));
cloudinary.config({
  cloud_name: process.env.DB_CLOUD_NAME,
  api_key: process.env.DB_CLOUD_API_KEY,
  api_secret: process.env.DB_CLOUD_API_SECRET,
});

async function uploadToCloudinary(locaFilePath) {
  var mainFolderName = "main";

  var filePathOnCloudinary = mainFolderName + "/" + locaFilePath;

  return cloudinary.uploader
    .upload(locaFilePath, { public_id: filePathOnCloudinary })
    .then((result) => {
      fs.unlinkSync(locaFilePath);

      return {
        message: "Success",
        url: result.url,
      };
    })
    .catch((error) => {
      // Remove file from local uploads folder
      fs.unlinkSync(locaFilePath);
      return { message: "Fail" };
    });
}

////////////PASSPRT SETUP///////////////////////

const passport = require("passport");

app.use(passport.initialize());
app.use(passport.session());

app.use(function (req, res, next) {
  res.locals.isAuthenticated = req.isAuthenticated();

  if (req.user) {
    res.locals.username = req.user.username;
    res.locals.link = "/users/" + req.user.username;
    res.locals.pic = req.user.image;
    res.locals.id = req.user._id;
    res.locals.tiny_api = process.env.DB_TINY_API_KEY;
  }

  next();
});

/////////////////////////////////////////////////

////////////MONGOOSE SETUP//////////////////////

// const ansSchema= new mongoose.Schema({
//   answer:String,
//   answeredBy:String
// });
const quesSchema = new mongoose.Schema({
  // id: String,
  title: String,
  body: String,
  upvote: Number,
  answers: [
    {
      answer: String,
      answeredBy: String,
      upvote: Number,
      upvotedBy: [String],
      downvotedBy: [String],
      time: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  askedby: { type: Schema.Types.ObjectId, ref: "User" },
  time: {
    type: Date,
    default: Date.now,
  },
  image: [String],
  profile: String,
  location: String,
});


const UserDetail = new mongoose.Schema({
  username: String,
  email: String,
  uniqueID: String,
  password: String,
  questions: [String],
  upvotedQuestions: [String],
  downvotedQuestions: [String],
  answeredQuestions: [String],
  answers: [String],
  time: {
    type: Date,
    default: Date.now,
  },
  image: String,
});

UserDetail.plugin(findOrCreate);
UserDetail.plugin(passportLocalMongoose);

const Question = mongoose.model("Question", quesSchema);
const User = mongoose.model("User", UserDetail);

///////////////////////////////////////////////////

///////////////PASSPORT LOCAL AUTHENTICATION ///////////

passport.use(User.createStrategy());

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

/////////////////////////////////////////////////////

////////////////PASSPORT GOOGLE STRATEGY//////////////

var GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.DB_GOOGLE_CLIENT_ID,
      clientSecret: process.env.DB_GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/snapshot",
    },
    function (accessToken, refreshToken, profile, cb) {
      let extractedUser = profile.emails[0].value.substring(
        0,
        profile.emails[0].value.indexOf("@")
      );
      User.findOrCreate(
        {
          username: extractedUser,
          email: profile.emails[0].value,
          image: "/uploads/noprofile.png",
        },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["email", "profile"],
  })
);

app.get(
  "/auth/google/snapshot",
  passport.authenticate("google", {
    failureRedirect: "/login",
  }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/");
  }
);

///////////PASSPORT FACEBOOK STRATEGY/////////////////////////////////

var FacebookStrategy = require("passport-facebook").Strategy;
const { authenticate } = require("passport");
const { profile } = require("console");

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.DB_FB_APP_ID,
      clientSecret: process.env.DB_FB_APP_SECRET,
      callbackURL: "http://localhost:3000/auth/facebook/snapshot",
      profileFields: ["id", "emails", "name"],
    },
    function (accessToken, refreshToken, profile, cb) {
      let extractedUser = profile.emails[0].value.substring(
        0,
        profile.emails[0].value.indexOf("@")
      );
      User.findOrCreate(
        {
          username: extractedUser,
          email: profile.emails[0].value,
          image: "/uploads/noprofile.png",
        },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

app.get(
  "/auth/facebook",
  passport.authenticate("facebook", {
    scope: ["email"],
  })
);

app.get(
  "/auth/facebook/snapshot",
  passport.authenticate("facebook", {
    failureRedirect: "/login",
  }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/");
  }
);

/////////////////////////////////////////////////////////

app.get("/", function (req, res) {
  res.render("home");
});

app.get("/login", function (req, res) {
  res.render("login", {
    text: "",
  });
});

app.post("/login", function (req, res) {
  passport.authenticate("local", function (err, user, info) {
    if (err) console.log(err);
    if (!user)
      res.render("login", {
        text: "Incorrect Password",
      });

    req.logIn(user, function (err) {
      if (err) console.log(err);

      res.redirect("/");
    });
  })(req, res);
});

app.get("/signup", function (req, res) {
  res.render("signup", {
    text: "",
  });
});

app.post("/signup", function (req, res) {
  User.findOne(
    {
      email: req.body.email,
    },
    function (err, foundUser) {
      if (err || foundUser) {
        // alert('Email Already Exists');
        res.render("signup", {
          text: "Email already exists",
        });
      } else {
        User.register(
          {
            username: req.body.username,
            email: req.body.email,
            image: "/uploads/noprofile.png",
          },
          req.body.password,
          function (err, user) {
            if (err) {
              res.render("signup", {
                text: "Username Already Exists",
              });
            }

            // const username = req.body.username;
            passport.authenticate("local")(req, res, function () {
              res.redirect("/");
            });
          }
        );
      }
    }
  );
});

app.get("/users/:username", async function (req, res) {
  var foundUser = await User.findOne(
    {
      username: req.params.username,
    });
  let questions = foundUser.questions;
  let cls, arr;
  if (
    req.query.questions === "profile" ||
    Object.keys(req.query).length === 0
  ) {
    cls = "profile";
    arr = [];
    arr = foundUser.answeredQuestions;
  } else if (req.query.questions === "asked") {
    cls = "added";
    arr = foundUser.questions;
  } else if (req.query.questions === "upvoted") {
    cls = "liked";
    arr = foundUser.upvotedQuestions;
  }
  var records = await Question.find().populate("askedby").where("_id").in(arr).exec();

  var upvoteAnswers = 0, upvoteQuestions = 0, goodQuestions = 0, goodAnswers=0;

  for(let i = 0; i < records.length; i++) {
    for (let j = 0; j < records[i].answers.length; j++) {
      if (
        records[i].answers[j].answeredBy === req.params.username
      ) {
        totalAnswers++;
        if (records[i].answers[j].upvote >= 1) goodAnswers++;
        upvoteAnswers += records[i].answers[j].upvote;
      }
    }
  }

  var records2 = await Question.find().populate("askedby").where("_id").in(questions).exec();

  var totalQuestions = records2.length;
  for (let i = 0; i < records2.length; i++) {
    if (records2[i].upvote >= 1) goodQuestions++;
    upvoteQuestions += records2[i].upvote;
  }


    if (req.user) {
      res.render("user", {
        user: foundUser,
        date: helper,
        cls: cls,
        arr: records,
        // rating: rating,
        upvoteQuestions: upvoteQuestions,
        upvoteAnswers: upvoteAnswers,
      });
    }
    else {
      // not logged in
      res.render("login");
    }
  });

app.get("/logout", function (req, res) {
  req.logout();
  req.session.destroy(function (err) {
    if (err) {
      return next(err);
    }
    // The response should indicate that the user is no longer authenticated.
    else res.redirect("/");
  });
});

// app.post("/ask", function (req, res) {

//   const question = new Question({
//     title: req.body.askTitle,
//     body: req.body.askBody,
//     upvote: 0,
//     askedBy: req.user.username,
//     // date = new Date()
//   });
//   question.save();

//   User.findOne(
//     {
//       username: req.user.username,
//     },
//     function (err, foundUser) {
//       if (err) console.log(err);
//       else {
//         Question.findOne(
//           {
//             title: req.body.askTitle,
//           },
//           function (err, foundQuestion) {
//             foundUser.questions.push(foundQuestion.id);
//             foundUser.save();
//           }
//         );
//       }
//     }
//   );

//   const link = "/questions/" + question.id;
//   res.redirect(link);
// });

app.get("/questions/:questionID", function (req, res) {
  Question.findOne({ "_id": req.params.questionID })
    .populate("askedby")
    .exec(function (err, foundQuestion) {
      if (err) {
        console.log(err);
      } else {
        res.render("question", {
          question: foundQuestion,
          date: helper,
          user: foundQuestion.askedby.username,
          query: req.query.sort,
        });
      }
    });
});

app.post("/vote", function (req, res) {
  User.findOne(
    {
      username: req.user.username,
    },
    function (err, foundUser) {
      if (err) console.log(err);
      else {
        if (req.body.value == "up") {
          var ifInDown = foundUser.downvotedQuestions.findIndex(function (
            item
          ) {
            return item === req.body.id;
          });
          if (ifInDown === -1) {
            var index = foundUser.upvotedQuestions.findIndex(function (item) {
              return item === req.body.id;
            });
            if (index === -1) {
              Question.findOneAndUpdate(
                {
                  _id: req.body.id,
                },
                {
                  $inc: {
                    upvote: 1,
                  },
                },
                (err, response) => {
                }
              );
              foundUser.upvotedQuestions.push(req.body.id);
              foundUser.save();
            }
          }
        } else if (req.body.value == "down") {
          var ifInUp = foundUser.upvotedQuestions.findIndex(function (item) {
            return item === req.body.id;
          });
          if (ifInUp === -1) {
            var index = foundUser.downvotedQuestions.findIndex(function (item) {
              return item === req.body.id;
            });
            if (index === -1) {
              Question.findOneAndUpdate(
                {
                  _id: req.body.id,
                },
                {
                  $inc: {
                    upvote: -1,
                  },
                },
                (err, response) => {
                }
              );
              foundUser.downvotedQuestions.push(req.body.id);
              foundUser.save();
            }
          }
        }
      }
    }
  );
  res.redirect("/list");
});

app.post("/vote2", function (req, res) {
  console.log(req.body);
  User.findOne(
    {
      username: req.user.username,
    },
    function (err, foundUser) {
      if (err) console.log(err);
      else {
        if (req.body.value == "up") {
          var ifInDown = foundUser.downvotedQuestions.findIndex(function (
            item
          ) {
            return item === req.body.id;
          });
          if (ifInDown === -1) {
            var index = foundUser.upvotedQuestions.findIndex(function (item) {
              return item === req.body.id;
            });
            if (index === -1) {
              Question.findOneAndUpdate(
                {
                  _id: req.body.id,
                },
                {
                  $inc: {
                    upvote: 1,
                  },
                },
                (err, response) => {
                }
              );
              foundUser.upvotedQuestions.push(req.body.id);
              foundUser.save();
            }
          }
        } else if (req.body.value == "down") {
          var ifInUp = foundUser.upvotedQuestions.findIndex(function (item) {
            return item === req.body.id;
          });
          if (ifInUp === -1) {
            var index = foundUser.downvotedQuestions.findIndex(function (item) {
              return item === req.body.id;
            });
            if (index === -1) {
              Question.findOneAndUpdate(
                {
                  _id: req.body.id,
                },
                {
                  $inc: {
                    upvote: -1,
                  },
                },
                (err, response) => {
                }
              );
              foundUser.downvotedQuestions.push(req.body.id);
              foundUser.save();
            }
          }
        }
      }
    }
  );
  const link = "/questions/" + req.body.id;
  res.redirect(link);
});

app.post("/answer/:questionID", function (req, res) {
  let id = req.params.questionID;
  Question.findById(req.params.questionID, function (err, foundQuestion) {
    if (err) console.log(err);
    else {
      const ans = {
        answer: req.body.askAnswer,
        answeredBy: req.user.username,
        upvote: 0,
      };
      foundQuestion.answers.push(ans);
      let answerID = foundQuestion.answers[foundQuestion.answers.length - 1].id;
      foundQuestion.save();

      User.findOne(
        {
          username: req.user.username,
        },
        function (err, foundUser) {
          if (err) console.log(err);
          else {
            if (!foundUser.answeredQuestions.includes(id))
              foundUser.answeredQuestions.push(id);

            foundUser.answers.push(answerID);
            foundUser.save();
          }
        }
      );

      const link = "/questions/" + req.params.questionID;
      res.redirect(link);
    }
  });
});

app.get("/list", function (req, res) {
  if (req.user) {
    // logged in

    if (req.query.sort == "asc") {
      Question.find(function (err, foundQuestions) {
        if (err) console.log(err);
        else {
          res.render("list", {
            foundQuestions: foundQuestions,
            date: helper,
            query: req.query.sort,
          });
        }
      }).sort({
        upvote: "asc",
      });
    } else if (req.query.sort == "dec") {
      Question.find({})
        .sort("-upvote")
        .populate("askedby")
        .exec(function (err, foundQuestions) {
          if (err) {
            console.log(err);
          } else {
            res.render("list", {
              foundQuestions: foundQuestions,
              date: helper,
              query: req.query.sort,
            });
          }
        });

    } else if (req.query.sort == "time" || !req.query.sort) {
      Question.find({})
        .sort("-time")
        .populate("askedby")
        .exec(function (err, foundQuestions) {
          if (err) {
            console.log(err);
          } else {
            // console.log(foundQuestions[0].askedby);
            res.render("list", {
              foundQuestions: foundQuestions,
              date: helper,
              query: req.query.sort,
            });
          }
        });
    }
  } else {
    // not logged in
    res.redirect("login");
  }
});

app.post("/voteAnswer", function (req, res) {
  console.log(req.body);
  Question.findById(req.body.id, function (err, foundQuestion) {
    if (err) console.log(err);
    else {
      for (var i = 0; i < foundQuestion.answers.length; i++) {
        if (foundQuestion.answers[i].id === req.body.answerid) {
          if (req.body.value == "up") {
            var ifInDown = foundQuestion.answers[i].downvotedBy.findIndex(
              function (item) {
                return item === req.user.username;
              }
            );

            if (ifInDown === -1) {
              var index = foundQuestion.answers[i].upvotedBy.findIndex(
                function (item) {
                  return item === req.user.username;
                }
              );

              if (index === -1) {
                foundQuestion.answers[i].upvote++;
                foundQuestion.answers[i].upvotedBy.push(req.user.username);
                foundQuestion.save();
              }
            }
          } else if (req.body.value == "down") {
            var ifInUp = foundQuestion.answers[i].upvotedBy.findIndex(function (
              item
            ) {
              return item === req.user.username;
            });

            if (ifInUp === -1) {
              var index = foundQuestion.answers[i].downvotedBy.findIndex(
                function (item) {
                  return item === req.user.username;
                  r;
                }
              );

              if (index === -1) {
                foundQuestion.answers[i].upvote--;
                foundQuestion.answers[i].downvotedBy.push(req.user.username);
                foundQuestion.save();
              }
            }
          }
        }
      }
    }
  });
  const link = "/questions/" + req.body.id;
  res.redirect(link);
});

app.post("/deleteQues/:questionID", function (req, res) {
  let id = req.params.questionID;

  Question.findByIdAndDelete(id, function (err, docs) {
    if (err) {
      console.log(err);
    } else {
      User.find({}, function (err, foundUser) {
        if (err) console.log(err);
        else {
          for (let i = 0; i < foundUser.length; i++) {
            const isLargeNumber = (element) => element === id;

            let ques = foundUser[i].questions.findIndex(isLargeNumber);
            let upQues = foundUser[i].upvotedQuestions.findIndex(isLargeNumber);
            let downQues =
              foundUser[i].downvotedQuestions.findIndex(isLargeNumber);
            if (ques != -1) foundUser[i].questions.splice(ques, 1);
            if (upQues != -1) foundUser[i].upvotedQuestions.splice(upQues, 1);
            if (downQues != -1)
              foundUser[i].downvotedQuestions.splice(downQues, 1);

            foundUser[i].save();
          }
        }
      });

      res.redirect("/list");
    }
  });
});

app.get("/ask", function (req, res) {
  if (req.user) {
    // logged in
    res.render("ask");
  } else {
    // not logged in
    res.redirect("login");
  }
});

app.post(
  "/photos-upload/:username",
  upload.array("image", 6),
  async (req, res, next) => {
    var imageUrlList = [];

    for (var i = 0; i < req.files.length; i++) {
      req.files[i].path = "public/uploads/" + req.files[i].filename;
      var locaFilePath = req.files[i].path;
      var result = await uploadToCloudinary(locaFilePath);
      imageUrlList.push(result.url);
    }

    const question = new Question({
      title: req.body.askTitle,
      upvote: 0,
      askedby: res.locals.id,
      image: imageUrlList,
    });

    question.save();

    User.findOne(
      {
        username: req.params.username,
      },
      function (err, foundUser) {
        if (err) console.log(err);
        else {
          Question.findOne(
            {
              title: req.body.askTitle,
            },
            function (err, foundQuestion) {
              foundUser.questions.push(foundQuestion.id);
              foundUser.save();
            }
          );
        }
      }
    );
    res.redirect("/list");
  }
);

app.post(
  "/users/:username/imageUpload",
  upload.single("profile-file"),
  async (req, res, next) => {
    var locaFilePath = "public/uploads/" + req.file.filename;
    var result = await uploadToCloudinary(locaFilePath);
    User.findOne(
      {
        username: req.params.username,
      },
      function (err, foundUser) {
        if (err) console.log(err);
        else {
          foundUser.image = result.url;
          foundUser.save();
        }
      }
    );
    res.redirect("/users/" + req.params.username);
  }
);
