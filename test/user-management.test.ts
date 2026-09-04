import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Client } from 'undici';
import type { Dispatcher } from 'undici';
import TAKAPI from '../lib/api.js';
import { APIAuthCertificate } from '../lib/auth.js';

type RequestArgs = Parameters<Client['request']>[0];

function mockResponse(statusCode: number, contentType: string, body: string): Dispatcher.ResponseData {
    return {
        statusCode,
        headers: { 'content-type': contentType },
        body: Readable.from([Buffer.from(body)]),
        trailers: {}
    } as unknown as Dispatcher.ResponseData;
}

async function capture(
    fn: (api: TAKAPI) => Promise<unknown>,
    response: Dispatcher.ResponseData = mockResponse(200, 'text/plain', '')
): Promise<{ captured: RequestArgs, result: unknown }> {
    const originalRequest = Client.prototype.request;

    let captured: RequestArgs | undefined;

    Client.prototype.request = async function(opts: RequestArgs): Promise<Dispatcher.ResponseData> {
        captured = opts;
        return response;
    };

    try {
        const api = new TAKAPI(new URL('https://tak.example.com'), new APIAuthCertificate('cert', 'key'));
        const result = await fn(api);
        assert.ok(captured);
        return { captured, result };
    } finally {
        Client.prototype.request = originalRequest;
    }
}

test('UserManagement.createUser posts a NewUserModel with defaulted group lists', async () => {
    const { captured } = await capture((api) => api.UserManagement.createUser({
        username: 'alice',
        password: 'Sup3rSecret!',
        groupListIN: ['Blue']
    }));

    assert.equal(captured.method, 'POST');
    assert.equal(captured.path, '/Marti/api/user-management/api/new-user');
    assert.deepEqual(JSON.parse(String(captured.body)), {
        username: 'alice',
        password: 'Sup3rSecret!',
        groupList: [],
        groupListIN: ['Blue'],
        groupListOUT: []
    });
});

test('UserManagement.createUsers posts a UserGenerationInBulkModel and returns generated credentials', async () => {
    const { captured, result } = await capture(
        (api) => api.UserManagement.createUsers({
            usernameExpression: 'team-[N]',
            startN: 1,
            endN: 2,
            groupList: ['Red']
        }),
        mockResponse(200, 'application/json', JSON.stringify([
            { username: 'team-1', password: 'p1' },
            { username: 'team-2', password: 'p2' }
        ]))
    );

    assert.equal(captured.method, 'POST');
    assert.equal(captured.path, '/Marti/api/user-management/api/new-users');
    assert.deepEqual(JSON.parse(String(captured.body)), {
        usernameExpression: 'team-[N]',
        startN: 1,
        endN: 2,
        groupList: ['Red'],
        groupListIN: [],
        groupListOUT: []
    });
    assert.deepEqual(result, [
        { username: 'team-1', password: 'p1' },
        { username: 'team-2', password: 'p2' }
    ]);
});

test('UserManagement.listUsers gets list-users', async () => {
    const { captured, result } = await capture(
        (api) => api.UserManagement.listUsers(),
        mockResponse(200, 'application/json', JSON.stringify([{ username: 'alice' }]))
    );

    assert.equal(captured.method, 'GET');
    assert.equal(captured.path, '/Marti/api/user-management/api/list-users');
    assert.deepEqual(result, [{ username: 'alice' }]);
});

test('UserManagement.userGroups encodes the username in the path', async () => {
    const { captured } = await capture(
        (api) => api.UserManagement.userGroups('a b'),
        mockResponse(200, 'application/json', JSON.stringify({
            username: 'a b', groupList: [], groupListIN: [], groupListOUT: []
        }))
    );

    assert.equal(captured.method, 'GET');
    assert.equal(captured.path, '/Marti/api/user-management/api/get-groups-for-user/a%20b');
});

test('UserManagement.changePassword puts a UserPasswordModel', async () => {
    const { captured } = await capture((api) => api.UserManagement.changePassword({
        username: 'alice',
        password: 'N3wSecret!'
    }));

    assert.equal(captured.method, 'PUT');
    assert.equal(captured.path, '/Marti/api/user-management/api/change-user-password');
    assert.deepEqual(JSON.parse(String(captured.body)), {
        username: 'alice',
        password: 'N3wSecret!'
    });
});

test('UserManagement.updateUserGroups puts a SimpleUserGroupModel', async () => {
    const { captured } = await capture((api) => api.UserManagement.updateUserGroups({
        username: 'alice',
        groupList: ['Blue'],
        groupListOUT: ['Red']
    }));

    assert.equal(captured.method, 'PUT');
    assert.equal(captured.path, '/Marti/api/user-management/api/update-groups');
    assert.deepEqual(JSON.parse(String(captured.body)), {
        username: 'alice',
        groupList: ['Blue'],
        groupListIN: [],
        groupListOUT: ['Red']
    });
});

test('UserManagement.updateGroupUsers puts a SimpleGroupWithUsersModel', async () => {
    const { captured } = await capture((api) => api.UserManagement.updateGroupUsers({
        groupname: 'Blue',
        usersInGroupListIN: ['alice', 'bob']
    }));

    assert.equal(captured.method, 'PUT');
    assert.equal(captured.path, '/Marti/api/user-management/api/update-group-users');
    assert.deepEqual(JSON.parse(String(captured.body)), {
        groupname: 'Blue',
        usersInGroupList: [],
        usersInGroupListIN: ['alice', 'bob'],
        usersInGroupListOUT: []
    });
});

test('UserManagement.deleteUser deletes by encoded username', async () => {
    const { captured } = await capture((api) => api.UserManagement.deleteUser('a/b'));

    assert.equal(captured.method, 'DELETE');
    assert.equal(captured.path, '/Marti/api/user-management/api/delete-user/a%2Fb');
});

test('UserManagement.listGroups gets list-groupnames', async () => {
    const { captured, result } = await capture(
        (api) => api.UserManagement.listGroups(),
        mockResponse(200, 'application/json', JSON.stringify([{ groupname: 'Blue' }]))
    );

    assert.equal(captured.method, 'GET');
    assert.equal(captured.path, '/Marti/api/user-management/api/list-groupnames');
    assert.deepEqual(result, [{ groupname: 'Blue' }]);
});

test('UserManagement.groupUsers gets users-in-group by encoded group name', async () => {
    const { captured, result } = await capture(
        (api) => api.UserManagement.groupUsers('Dark Blue'),
        mockResponse(200, 'application/json', JSON.stringify({
            groupname: 'Dark Blue',
            usersInGroupList: ['alice'],
            usersInGroupListIN: [],
            usersInGroupListOUT: ['bob']
        }))
    );

    assert.equal(captured.method, 'GET');
    assert.equal(captured.path, '/Marti/api/user-management/api/users-in-group/Dark%20Blue');
    assert.deepEqual(result, {
        groupname: 'Dark Blue',
        usersInGroupList: ['alice'],
        usersInGroupListIN: [],
        usersInGroupListOUT: ['bob']
    });
});

test('UserManagement.cli list-users formats usernames as lines', async () => {
    const { result } = await capture(
        (api) => api.UserManagement.cli({ _: ['tsx', 'cli.ts', 'user-management', 'list-users'] }),
        mockResponse(200, 'application/json', JSON.stringify([{ username: 'alice' }, { username: 'bob' }]))
    );

    assert.equal(result, 'alice\nbob');
});
