import { test } from "ava";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";

import Api from "../src";

test.beforeEach(t => {
  const client = axios.create();
  t.context.mock = new MockAdapter(client);
  t.context.api = new Api({ client });
});

test("Login captures token information", async t => {
  const { mock, api } = t.context;
  const LOGIN_REQUEST = {
    login: "foo",
    password: "foo",
  };
  const LOGIN_RESPONSE = {
    token: "TOKEN",
    refreshToken: "REFRESH_TOKEN",
  };

  mock.onPost("/auth/login", LOGIN_REQUEST).reply(200, LOGIN_RESPONSE);
  mock.onGet("/users").reply(200, []);

  await api.login(LOGIN_REQUEST);
  await api.getUsers();

  t.is(mock.history.get.length, 1);
  t.is(
    mock.history.get[0].headers.Authorization,
    `Bearer ${LOGIN_RESPONSE.token}`
  );
});

test("Logout removes token information", async t => {
  const { mock, api } = t.context;
  const LOGIN_REQUEST = {
    login: "foo",
    password: "foo",
  };
  const LOGIN_RESPONSE = {
    token: "TOKEN",
    refreshToken: "REFRESH_TOKEN",
  };

  mock.onPost("/auth/login", LOGIN_REQUEST).reply(200, LOGIN_RESPONSE);
  mock.onGet("/users").reply(200, []);

  await api.login(LOGIN_REQUEST);
  await api.logout();
  await api.getUsers();

  t.is(mock.history.get.length, 1);
  t.falsy(mock.history.get[0].headers.Authorization);
});

test("Correctly retries request when got 401 with new token", async t => {
  const { mock, api } = t.context;
  const LOGIN_REQUEST = {
    login: "foo",
    password: "foo",
  };
  const LOGIN_RESPONSE = {
    token: "TOKEN",
    refreshToken: "REFRESH_TOKEN",
  };

  const REFRESH_REQUEST = {
    refreshToken: LOGIN_RESPONSE.refreshToken,
  };
  const REFRESH_RESPONSE = {
    token: "TOKEN2",
    refreshToken: "REFRESH_TOKEN2",
  };

  mock.onPost("/auth/login", LOGIN_REQUEST).reply(200, LOGIN_RESPONSE);
  mock
    .onPost("/auth/refresh", REFRESH_REQUEST)
    .replyOnce(200, REFRESH_RESPONSE);
  mock.onGet("/users").reply(config => {
    const { Authorization: auth } = config.headers;
    if (auth === `Bearer ${LOGIN_RESPONSE.token}`) {
      return [401];
    }
    if (auth === `Bearer ${REFRESH_RESPONSE.token}`) {
      return [200, []];
    }
    return [404];
  });

  await api.login(LOGIN_REQUEST);
  await api.getUsers();
  t.is(mock.history.get.length, 2);
  t.is(
    mock.history.get[1].headers.Authorization,
    `Bearer ${REFRESH_RESPONSE.token}`
  );
});

test("Correctly fails request when got non-401 error", async t => {
  const { mock, api } = t.context;
  mock.onGet("/users").reply(404);
  await t.throws(async () => {
    await api.getUsers();
  });
});

test("Does not consumes token more than once", async t => {
  const { mock, api } = t.context;
  const LOGIN_REQUEST = {
    login: "foo",
    password: "foo",
  };
  const LOGIN_RESPONSE = {
    token: "TOKEN",
    refreshToken: "REFRESH_TOKEN",
  };

  const REFRESH_REQUEST = {
    refreshToken: LOGIN_RESPONSE.refreshToken,
  };
  const REFRESH_RESPONSE = {
    token: "TOKEN2",
    refreshToken: "REFRESH_TOKEN2",
  };

  mock.onPost("/auth/login", LOGIN_REQUEST).reply(200, LOGIN_RESPONSE);
  mock
    .onPost("/auth/refresh", REFRESH_REQUEST)
    .replyOnce(200, REFRESH_RESPONSE);

  mock.onGet("/users").reply(config => {
    const { Authorization: auth } = config.headers;
    if (auth === `Bearer ${LOGIN_RESPONSE.token}`) {
      return [401];
    }
    if (auth === `Bearer ${REFRESH_RESPONSE.token}`) {
      return [200, []];
    }
    return [404];
  });

  await api.login(LOGIN_REQUEST);
  await Promise.all([api.getUsers(), api.getUsers()]);
  t.is(
    mock.history.post.filter(({ url }) => url === "/auth/refresh").length,
    1
  );
});
