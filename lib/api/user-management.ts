import { Type, Static } from '@sinclair/typebox';
import Commands, { CommandOutputFormat, type ParsedArgs } from '../commands.js';

const GroupLists = {
    groupList: Type.Optional(Type.Array(Type.String())),
    groupListIN: Type.Optional(Type.Array(Type.String())),
    groupListOUT: Type.Optional(Type.Array(Type.String()))
};

export const UserManagementUsername = Type.Object({
    username: Type.String()
});

export const UserManagementGroupName = Type.Object({
    groupname: Type.String()
});

export const UserManagementNewUser = Type.Object({
    username: Type.String(),
    password: Type.String(),
    ...GroupLists
});

export const UserManagementBulkUsers = Type.Object({
    usernameExpression: Type.String({ description: 'Username pattern containing [N] which is replaced by each integer from startN to endN' }),
    startN: Type.Integer(),
    endN: Type.Integer(),
    ...GroupLists
});

export const UserManagementUserPassword = Type.Object({
    username: Type.String(),
    password: Type.String()
});

export const UserManagementUserGroups = Type.Object({
    username: Type.String(),
    ...GroupLists
});

export const UserManagementGroupUsers = Type.Object({
    groupname: Type.String(),
    usersInGroupList: Type.Optional(Type.Array(Type.String())),
    usersInGroupListIN: Type.Optional(Type.Array(Type.String())),
    usersInGroupListOUT: Type.Optional(Type.Array(Type.String()))
});

export const UserManagementList_Username = Type.Array(UserManagementUsername);
export const UserManagementList_GroupName = Type.Array(UserManagementGroupName);
export const UserManagementList_UserPassword = Type.Array(UserManagementUserPassword);

export const UserManagementUserGroupsResponse = Type.Object({
    username: Type.String(),
    groupList: Type.Array(Type.String()),
    groupListIN: Type.Array(Type.String()),
    groupListOUT: Type.Array(Type.String())
});

export const UserManagementGroupUsersResponse = Type.Object({
    groupname: Type.String(),
    usersInGroupList: Type.Array(Type.String()),
    usersInGroupListIN: Type.Array(Type.String()),
    usersInGroupListOUT: Type.Array(Type.String())
});

/**
 * Manage File (non-LDAP) User Accounts on TAK Server
 *
 * {@link https://docs.tak.gov/api/takserver#tag/file-user-account-management-api TAK Server Docs}.
 */
export default class UserManagementCommands extends Commands {
    schema = {
        'list-users': {
            description: 'List File Users',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        },
        'list-groups': {
            description: 'List Group Names used by File Users',
            params: Type.Object({}),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        },
        'user-groups': {
            description: 'List Groups for a given File User',
            params: Type.Object({ username: Type.String() }),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        },
        'group-users': {
            description: 'List File Users in a given Group',
            params: Type.Object({ group: Type.String() }),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        },
        'delete-user': {
            description: 'Delete a File User',
            params: Type.Object({ username: Type.String() }),
            query: Type.Object({}),
            formats: [ CommandOutputFormat.JSON ]
        }
    }

    async cli(args: ParsedArgs): Promise<object | string> {
        if (args._[3] === 'list-users') {
            const list = await this.listUsers();

            if (args.format === 'json') {
                return list;
            } else {
                return list.map((user) => user.username).join('\n');
            }
        } else if (args._[3] === 'list-groups') {
            const list = await this.listGroups();

            if (args.format === 'json') {
                return list;
            } else {
                return list.map((group) => group.groupname).join('\n');
            }
        } else if (args._[3] === 'user-groups') {
            if (!args._[4]) throw new Error('username must be provided');

            const user = await this.userGroups(args._[4]);

            if (args.format === 'json') {
                return user;
            } else {
                return [
                    `${user.username}`,
                    `  BOTH: ${user.groupList.join(', ')}`,
                    `  IN:   ${user.groupListIN.join(', ')}`,
                    `  OUT:  ${user.groupListOUT.join(', ')}`
                ].join('\n');
            }
        } else if (args._[3] === 'group-users') {
            if (!args._[4]) throw new Error('group must be provided');

            const group = await this.groupUsers(args._[4]);

            if (args.format === 'json') {
                return group;
            } else {
                return [
                    `${group.groupname}`,
                    `  BOTH: ${group.usersInGroupList.join(', ')}`,
                    `  IN:   ${group.usersInGroupListIN.join(', ')}`,
                    `  OUT:  ${group.usersInGroupListOUT.join(', ')}`
                ].join('\n');
            }
        } else if (args._[3] === 'delete-user') {
            if (!args._[4]) throw new Error('username must be provided');

            await this.deleteUser(args._[4]);

            return `Deleted ${args._[4]}`;
        } else {
            throw new Error('Unsupported Subcommand');
        }
    }

    /**
     * Create a new File User
     *
     * {@link https://docs.tak.gov/api/takserver#tag/file-user-account-management-api/operation/createOrUpdateFileUser TAK Server Docs}.
     */
    async createUser(user: Static<typeof UserManagementNewUser>): Promise<void> {
        const url = new URL('/Marti/api/user-management/api/new-user', this.api.url);

        await this.api.fetch(url, {
            method: 'POST',
            body: {
                username: user.username,
                password: user.password,
                groupList: user.groupList ?? [],
                groupListIN: user.groupListIN ?? [],
                groupListOUT: user.groupListOUT ?? []
            }
        });
    }

    /**
     * Create File Users in bulk from a username expression containing `[N]`
     * Passwords are generated by the server and only returned once
     *
     * {@link https://docs.tak.gov/api/takserver#tag/file-user-account-management-api/operation/createFileUsersInBulk TAK Server Docs}.
     */
    async createUsers(
        bulk: Static<typeof UserManagementBulkUsers>
    ): Promise<Static<typeof UserManagementList_UserPassword>> {
        const url = new URL('/Marti/api/user-management/api/new-users', this.api.url);

        return await this.api.fetch(url, {
            method: 'POST',
            body: {
                usernameExpression: bulk.usernameExpression,
                startN: bulk.startN,
                endN: bulk.endN,
                groupList: bulk.groupList ?? [],
                groupListIN: bulk.groupListIN ?? [],
                groupListOUT: bulk.groupListOUT ?? []
            }
        });
    }

    /**
     * List all File Users
     *
     * {@link https://docs.tak.gov/api/takserver#tag/file-user-account-management-api/operation/getAllUsers_3 TAK Server Docs}.
     */
    async listUsers(): Promise<Static<typeof UserManagementList_Username>> {
        const url = new URL('/Marti/api/user-management/api/list-users', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Get the Groups associated with a File User
     *
     * {@link https://docs.tak.gov/api/takserver#tag/file-user-account-management-api/operation/getGroupsForUsers TAK Server Docs}.
     */
    async userGroups(username: string): Promise<Static<typeof UserManagementUserGroupsResponse>> {
        const url = new URL(`/Marti/api/user-management/api/get-groups-for-user/${encodeURIComponent(username)}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Change the password of a File User
     *
     * {@link https://docs.tak.gov/api/takserver#tag/file-user-account-management-api/operation/changeUserPassword TAK Server Docs}.
     */
    async changePassword(user: Static<typeof UserManagementUserPassword>): Promise<void> {
        const url = new URL('/Marti/api/user-management/api/change-user-password', this.api.url);

        await this.api.fetch(url, {
            method: 'PUT',
            body: {
                username: user.username,
                password: user.password
            }
        });
    }

    /**
     * Replace the Groups associated with a File User
     *
     * {@link https://docs.tak.gov/api/takserver#tag/file-user-account-management-api/operation/updateGroupsForUser TAK Server Docs}.
     */
    async updateUserGroups(user: Static<typeof UserManagementUserGroups>): Promise<void> {
        const url = new URL('/Marti/api/user-management/api/update-groups', this.api.url);

        await this.api.fetch(url, {
            method: 'PUT',
            body: {
                username: user.username,
                groupList: user.groupList ?? [],
                groupListIN: user.groupListIN ?? [],
                groupListOUT: user.groupListOUT ?? []
            }
        });
    }

    /**
     * Replace the File Users associated with a Group
     *
     * {@link https://docs.tak.gov/api/takserver#tag/file-user-account-management-api/operation/updateUsersForGroup TAK Server Docs}.
     */
    async updateGroupUsers(group: Static<typeof UserManagementGroupUsers>): Promise<void> {
        const url = new URL('/Marti/api/user-management/api/update-group-users', this.api.url);

        await this.api.fetch(url, {
            method: 'PUT',
            body: {
                groupname: group.groupname,
                usersInGroupList: group.usersInGroupList ?? [],
                usersInGroupListIN: group.usersInGroupListIN ?? [],
                usersInGroupListOUT: group.usersInGroupListOUT ?? []
            }
        });
    }

    /**
     * Delete a File User
     *
     * {@link https://docs.tak.gov/api/takserver#tag/file-user-account-management-api/operation/deleteUser_1 TAK Server Docs}.
     */
    async deleteUser(username: string): Promise<void> {
        const url = new URL(`/Marti/api/user-management/api/delete-user/${encodeURIComponent(username)}`, this.api.url);

        await this.api.fetch(url, {
            method: 'DELETE'
        });
    }

    /**
     * List all Group Names used by File Users
     *
     * {@link https://docs.tak.gov/api/takserver#tag/file-user-account-management-api/operation/getAllGroupNames TAK Server Docs}.
     */
    async listGroups(): Promise<Static<typeof UserManagementList_GroupName>> {
        const url = new URL('/Marti/api/user-management/api/list-groupnames', this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    /**
     * Get the File Users in a Group along with their IN/OUT/BOTH direction
     *
     * {@link https://docs.tak.gov/api/takserver#tag/file-user-account-management-api/operation/getUsersInGroup TAK Server Docs}.
     */
    async groupUsers(group: string): Promise<Static<typeof UserManagementGroupUsersResponse>> {
        const url = new URL(`/Marti/api/user-management/api/users-in-group/${encodeURIComponent(group)}`, this.api.url);

        return await this.api.fetch(url, {
            method: 'GET'
        });
    }
}
