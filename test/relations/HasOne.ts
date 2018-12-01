import * as Odin from "../../src";

declare global {
  namespace NodeJS {
    interface Global {
      __MONGO_DB_NAME__: string;
      __MONGO_CONNECTION__: any;
    }
  }
}

const Types = Odin.Types;

const USERS = [
  {
    username: "ardalanamini",
    email: "ardalanamini22@gmail.com",
    name: {
      first: "Ardalan",
      last: "Amini",
    },
  },
  {
    username: "john",
    email: "johndue@example.com",
    name: {
      first: "John",
      last: "Due",
    },
  },
];

const CHATS = [
  {
    username: "ardalanamini",
    name: "test",
  },
];

const MESSAGES = [
  {
    chatname: "test",
    message: "Hello World",
  },
];

Odin.Connect({
  default: {
    database: global.__MONGO_DB_NAME__,
    connection: global.__MONGO_CONNECTION__,
  },
});

@Odin.register
class User extends Odin {
  public static schema = {
    username: Types.string.alphanum.min(3).required,
    email: Types.string.email.required,
    name: {
      first: Types.string.min(3).required,
      last: Types.string.min(3),
    },
  };

  @Odin.relation
  public chat() {
    return this.hasOne<Chat>("Chat", "username", "username");
  }
}

// tslint:disable-next-line:max-classes-per-file
@Odin.register
class Chat extends Odin {
  public static schema = {
    username: Types.string.alphanum.min(3).required,
    name: Types.string.required,
  };

  @Odin.relation
  public user() {
    return this.hasOne<User>("User", "username", "username");
  }

  @Odin.relation
  public message() {
    return this.hasOne<Message>("Message", "name", "chatname");
  }
}

// tslint:disable-next-line:max-classes-per-file
@Odin.register
class Message extends Odin {
  public static schema = {
    chatname: Types.string.required,
    message: Types.string.required,
  };

  @Odin.relation
  public chat() {
    return this.hasOne<Chat>("Chat", "chatname", "name");
  }
}

const refresh = async (done: jest.DoneCallback) => {
  await User.delete();
  await User.insert(USERS);
  const users: any[] = await User.lean().get();
  USERS.length = 0;
  USERS.push(...users);

  await Chat.delete();
  await Chat.insert(CHATS);
  const chats: any[] = await Chat.lean().get();
  CHATS.length = 0;
  CHATS.push(...chats);

  await Message.delete();
  await Message.insert(MESSAGES);
  const messages: any[] = await Message.lean().get();
  MESSAGES.length = 0;
  MESSAGES.push(...messages);

  done();
};

beforeAll(refresh);

afterEach(refresh);

afterAll(async (done) => {
  await User.delete();
  await Chat.delete();
  await Message.delete();

  done();
});

test("Model.with", async () => {
  expect.assertions(2);

  const items = USERS.map(user => ({
    ...user,
    chat: CHATS.filter(chat => chat.username === user.username)[0],
  }));

  const results = await User.with("chat").lean().get();

  expect(results).toEqual(items);

  const results2 = await User.with("chat").get();

  expect(results2.map((item: any) => item.toJSON())).toEqual(items);
});

test("Model.with deep", async () => {
  expect.assertions(4);

  const items = USERS.map((user) => {
    const chat = CHATS.filter(chat => chat.username === user.username)[0];

    if (chat) (chat as any).message = MESSAGES.filter(message => message.chatname === chat.name)[0];

    return {
      ...user,
      chat,
    };
  });

  const results = await User.with("chat", "chat.message").lean().get();

  expect(results).toEqual(items);

  const results2 = await User.with("chat.message").lean().get();

  expect(results2).toEqual(items);

  const results3 = await User.with("chat", "chat.message").get();

  expect(results3).toEqual(items);

  const results4 = await User.with("chat.message").get();

  expect(results4.map((item: any) => item.toJSON())).toEqual(items);
});
