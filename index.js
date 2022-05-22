require("dotenv").config();

const { DB_URI, CLIENT_ID, MY_ID } = process.env;
const {
  TelegramToken,
  AdminId,
  StripeSecretKey,
  cardHolderId,
} = require("./config");
const stripe = require("stripe")(StripeSecretKey);
const crypto = require("crypto");
const faker = require("faker");
const randomName = faker.name.findName();
const mongoose = require("mongoose");
const randomEmail = faker.internet.email();
const TokenModel = require("./models/Token");
const TelegramBot = require("node-telegram-bot-api");

const token = TelegramToken;

const checkAdmin = (chatId) => {
  if (chatId == AdminId || chatId == MY_ID) {
    return true;
  }
  return false;
};

const checkClient = (chatId) => {
  if (chatId == AdminId || chatId == CLIENT_ID || chatId == MY_ID) {
    return true;
  }
  return false;
};

const createCard = async (cardholder) => {
  const card = await stripe.issuing.cards.create({
    cardholder,
    currency: "gbp",
    type: "virtual",
    status: "active",
  });

  return card;
};

const createVCC = async (cardId) => {
  const card = await stripe.issuing.cards.retrieve(cardId, {
    expand: ["number", "cvc"],
  });

  console.log(card);

  return card;
};
mongoose
  .connect(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((res) => {
    console.log("Mongo Connected");
  })
  .catch((err) => console.log(err));

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "🤗 Hello! I am a bot for generation the VCC Card");
});

bot.onText(/\/gt (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const limit = match[1];
  if (checkAdmin(chatId)) {
    const generateToken = crypto.randomBytes(48).toString("hex");
    TokenModel.save({
      body: generateToken,
      limit: limit,
    })
      .then((res) => {
        console.log(res);
        const opts = {
          parse_mode: "HTML",
        };
        bot.sendMessage(
          chatId,
          `✅ New Token Created\n\nToken:\n\n<code>${res.data.body}</code>\n\nLimit: ${res.data.limit}`,
          opts
        );
      })
      .catch((err) => {
        console.log(err);
        bot.sendMessage(chatId, "🚨 Cannot create token, something was wrong");
      });
  } else {
    bot.sendMessage(chatId, "🚨 You have no permission to generate token");
  }
});

bot.onText(/\/ct (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const token = match[1];
  if (checkAdmin(chatId)) {
    TokenModel.findOne({
      token: token,
    })
      .then((res) => {
        console.log(res);
        const opts = {
          parse_mode: "HTML",
        };
        bot.sendMessage(
          chatId,
          `✅ Token Infos\n\nToken:\n\n<code>${res.data.body}</code>\n\nRemaining Count: ${res.data.limit}`,
          opts
        );
      })
      .catch((err) => {
        bot.sendMessage(chatId, "🚨 Cannot check token, something was wrong");
      });
  } else {
    bot.sendMessage(chatId, "🚨 You have no permission to check token");
  }
});

bot.onText(/\/rd (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const token = match[1];
  if (checkClient(chatId)) {
    const findToken = await TokenModel.findOne({ token: token });
    if (findToken) {
      const updateLimit = findToken.data?.limit - 1;
      TokenModel.update({
        token: token,
        limit: updateLimit,
      })
        .then(async (res) => {
          if (res.data.limit > 0) {
            const card = await createCard(cardHolderId);
            const vccCard = await createVCC(card.id);
            const opts = {
              parse_mode: "HTML",
            };
            bot.sendMessage(
              chatId,
              `✅ Your VCC Card below\n\nCard Number\n<code>${vccCard.number}</code>\n\nExpiration\n<code>${vccCard.exp_month}/${vccCard.exp_year}</code>\n\nCVC\n<code>${vccCard.cvc}</code>\n\n🚀 Remaining limit for this token : ${updateLimit} Times`,
              opts
            );
          } else {
            bot.sendMessage(chatId, "🚨 This token has reached the Limit");
          }
        })
        .catch((err) => {
          console.log(err);
          bot.sendMessage(
            chatId,
            "🚨 Cannot redeem token, something was wrong"
          );
        });
    } else {
      bot.sendMessage(chatId, "🚨 Token not found");
    }
  } else {
    bot.sendMessage(chatId, "🚨 You have no permission to redeem token");
  }
});

// Listen for any kind of message. There are different kinds of
// messages.
//
// bot.on("message", (msg) => {
//   const chatId = msg.chat.id;
//   const message = msg.text;

//   // send a message to the chat acknowledging receipt of their message
//   bot.sendMessage(chatId, "Received your message");
// });
