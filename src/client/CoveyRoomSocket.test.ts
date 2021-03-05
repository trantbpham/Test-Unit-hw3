import Express from 'express';
import CORS from 'cors';
import http from 'http';
import { AddressInfo } from 'net';
import { nanoid } from 'nanoid';
import * as TestUtils from '../TestUtils';

import addRoomRoutes from '../router/room';
import RoomServiceClient from './RoomServiceClient';
import { ConfigureTest, StartTest } from '../FaultManager';
import Player from '../types/Player';


describe('RoomServiceApiSocket', () => {
  /* A testing server that will be deployed before testing and reused throughout all of the tests */
  let server: http.Server;
  /* A testing client that will be automatically configured with a serviceURL to point to the testing server */
  let apiClient: RoomServiceClient;

  beforeAll(async () => {
    // Deploy a testing server
    const app = Express();
    app.use(CORS());
    server = http.createServer(app);
    addRoomRoutes(server, app);
    server.listen();
    const address = server.address() as AddressInfo;

    // Create the testing client
    apiClient = new RoomServiceClient(`http://127.0.0.1:${address.port}`);
  });
  afterAll(async () => {
    // After all tests are done, shut down the server to avoid any resource leaks
    server.close();
  });
  afterEach(() => {
    // Clean up any sockets that are created during each test by the TestUtils.createSocketClient helper
    TestUtils.cleanupSockets();
  });
  it.each(ConfigureTest('CRSID'))('Rejects invalid CoveyRoomIDs, even if otherwise valid session token [%s]', async (testConfiguration: string) => {
    StartTest(testConfiguration);
    /* Example test that demonstrates how to use the socket helpers - feel free to keep this code
    change it, or replace it entirely. Note that you might find it handy to extract some of the common behavior between
    lots of tests (like creating a room and joining it) into helper functions.
     */

    // Create a new room, so that we can make a valid session token
    const validRoom = await apiClient.createRoom({ isPubliclyListed: true, friendlyName: 'Test Room' });

    // Get a valid session token by joining the room
    const { coveySessionToken: validSessionToken } = await apiClient.joinRoom({
      coveyRoomID: validRoom.coveyRoomID,
      userName: nanoid(),
    });

    const { socketDisconnected, socketConnected } = TestUtils.createSocketClient(server, validSessionToken, nanoid());
    await socketConnected; 
    await socketDisconnected; 

  });
  it.each(ConfigureTest('CRSST'))('Rejects invalid session tokens, even if otherwise valid room id [%s]', async (testConfiguration: string) => {
    StartTest(testConfiguration);
    // Create a new room, so that we can make a valid session token
    
    const validRoom = await apiClient.createRoom({ isPubliclyListed: true, friendlyName: 'Test Room' });
    

    const { socketDisconnected, socketConnected } = TestUtils.createSocketClient(server, 'invalid stuffs', validRoom.coveyRoomID);
    await socketConnected; 
    await socketDisconnected;

    // Hint: the TestUtils.createSocketClient method is how you should create your socket for testing.
  });
  it.each(ConfigureTest('CRSMU'))('Dispatches movement updates to all clients in the same room [%s]', async (testConfiguration: string) => {
    StartTest(testConfiguration);

    const newUser1 = new Player('testUser');
    const newUser2 = new Player('testUser1');
    const newUser3 = new Player('testUser2');

    const validRoom = await apiClient.createRoom({ isPubliclyListed: true, friendlyName: 'Test Room' });
    const { coveySessionToken: validSessionToken1 } = await apiClient.joinRoom({
      coveyRoomID: validRoom.coveyRoomID,
      userName: newUser1.userName,
    });

    const { coveySessionToken: validSessionToken2 } = await apiClient.joinRoom({
      coveyRoomID: validRoom.coveyRoomID,
      userName: newUser2.userName,
    });

    const { coveySessionToken: validSessionToken3 } = await apiClient.joinRoom({
      coveyRoomID: validRoom.coveyRoomID,
      userName: newUser3.userName,
    });

    const socketConnected1 = TestUtils.createSocketClient(server, validSessionToken1, validRoom.coveyRoomID);
    const socketConnected2 = TestUtils.createSocketClient(server, validSessionToken2, validRoom.coveyRoomID);
    const socketConnected3 = TestUtils.createSocketClient(server, validSessionToken3, validRoom.coveyRoomID);

    await socketConnected1.socketConnected;
    await socketConnected2.socketConnected;
    await socketConnected3.socketConnected;

    socketConnected1.socket.emit('playerMovement', newUser1);

    await socketConnected2.playerMoved;
    await socketConnected3.playerMoved;


  });
  it.each(ConfigureTest('CRSDC'))('Invalidates the user session after disconnection [%s]', async (testConfiguration: string) => {
    StartTest(testConfiguration);

    const validRoom = await apiClient.createRoom({ isPubliclyListed: true, friendlyName: 'Test Room' });

    const { coveySessionToken: validSessionToken } = await apiClient.joinRoom({
      coveyRoomID: validRoom.coveyRoomID,
      userName: nanoid(),
    });
    const newUser1 = new Player('testUser');
    const newUser2 = new Player('testUser1');
    const newUser3 = new Player('testUser2');

    const newRoomJoinRequest1 = {
      userName: newUser1.userName,
      coveyRoomID: validRoom.coveyRoomID,
    };
    const newRoomJoinRequest2 = {
      userName: newUser2.userName,
      coveyRoomID: validRoom.coveyRoomID,
    };
    const newRoomJoinRequest3 = {
      userName: newUser3.userName,
      coveyRoomID: validRoom.coveyRoomID,
    };

    const socketConnected1 = TestUtils.createSocketClient(server, validSessionToken, validRoom.coveyRoomID);
    const socketConnected2 = TestUtils.createSocketClient(server, validSessionToken, validRoom.coveyRoomID);
    const socketConnected3 = TestUtils.createSocketClient(server, validSessionToken, validRoom.coveyRoomID);

    await apiClient.joinRoom(newRoomJoinRequest1);
    await apiClient.joinRoom(newRoomJoinRequest2);
    await apiClient.joinRoom(newRoomJoinRequest3);

    await socketConnected1.socketConnected;
    await socketConnected2.socketConnected;
    await socketConnected3.socketConnected; 
    
    socketConnected1.socket.disconnect();

    await socketConnected2.playerDisconnected;
    await socketConnected3.playerDisconnected;
  });
  it.each(ConfigureTest('CRSNP'))('Informs all new players when a player joins [%s]', async (testConfiguration: string) => {
    StartTest(testConfiguration);
    const validRoom = await apiClient.createRoom({ isPubliclyListed: true, friendlyName: 'Test Room' });
    const { coveySessionToken: validSessionToken } = await apiClient.joinRoom({
      coveyRoomID: validRoom.coveyRoomID,
      userName: nanoid(),
    });
    const newUser1 = new Player('testUser');
    const newUser2 = new Player('testUser1');
    const newUser3 = new Player('testUser2');

    const newRoomJoinRequest1 = {
      userName: newUser1.userName,
      coveyRoomID: validRoom.coveyRoomID,
    };
    const newRoomJoinRequest2 = {
      userName: newUser2.userName,
      coveyRoomID: validRoom.coveyRoomID,
    };
    const newRoomJoinRequest3 = {
      userName: newUser3.userName,
      coveyRoomID: validRoom.coveyRoomID,
    };

    const socketConnected1 = TestUtils.createSocketClient(server, validSessionToken, validRoom.coveyRoomID);
    const socketConnected2 = TestUtils.createSocketClient(server, validSessionToken, validRoom.coveyRoomID);
    const socketConnected3 = TestUtils.createSocketClient(server, validSessionToken, validRoom.coveyRoomID);

    await apiClient.joinRoom(newRoomJoinRequest1);
    await apiClient.joinRoom(newRoomJoinRequest2);
    await apiClient.joinRoom(newRoomJoinRequest3);

    await socketConnected1.socketConnected;
    await socketConnected2.socketConnected;
    await socketConnected3.socketConnected; 
    
    await socketConnected1.newPlayerJoined;
    await socketConnected2.newPlayerJoined; 


  });

  it.each(ConfigureTest('CRSDCN'))('Informs all players when a player disconnects [%s]', async (testConfiguration: string) => {
    StartTest(testConfiguration);
    const validRoom = await apiClient.createRoom({ isPubliclyListed: true, friendlyName: 'Test Room' });
    const { coveySessionToken: validSessionToken1 } = await apiClient.joinRoom({
      coveyRoomID: validRoom.coveyRoomID,
      userName: nanoid(),
    });

    const { coveySessionToken: validSessionToken2 } = await apiClient.joinRoom({
      coveyRoomID: validRoom.coveyRoomID,
      userName: nanoid(),
    });

    const { coveySessionToken: validSessionToken3 } = await apiClient.joinRoom({
      coveyRoomID: validRoom.coveyRoomID,
      userName: nanoid(),
    });
    const newUser1 = new Player('testUser');
    const newUser2 = new Player('testUser1');
    const newUser3 = new Player('testUser2');

    const newRoomJoinRequest1 = {
      userName: newUser1.userName,
      coveyRoomID: validRoom.coveyRoomID,
    };
    const newRoomJoinRequest2 = {
      userName: newUser2.userName,
      coveyRoomID: validRoom.coveyRoomID,
    };
    const newRoomJoinRequest3 = {
      userName: newUser3.userName,
      coveyRoomID: validRoom.coveyRoomID,
    };

    const socketConnected1 = TestUtils.createSocketClient(server, validSessionToken1, validRoom.coveyRoomID);
    const socketConnected2 = TestUtils.createSocketClient(server, validSessionToken2, validRoom.coveyRoomID);
    const socketConnected3 = TestUtils.createSocketClient(server, validSessionToken3, validRoom.coveyRoomID);

    await apiClient.joinRoom(newRoomJoinRequest1);
    await apiClient.joinRoom(newRoomJoinRequest2);
    await apiClient.joinRoom(newRoomJoinRequest3);

    await socketConnected1.socketConnected;
    await socketConnected2.socketConnected;
    await socketConnected3.socketConnected;
    socketConnected2.socket.disconnect();

    await socketConnected1.playerDisconnected;
    await socketConnected3.playerDisconnected;

  });
  it.each(ConfigureTest('CRSDCDX'))('Informs all players when the room is destroyed [%s]', async (testConfiguration: string) => {
    StartTest(testConfiguration);

    const validRoom = await apiClient.createRoom({ isPubliclyListed: true, friendlyName: 'Test Room' });
    const { coveySessionToken: validSessionToken1 } = await apiClient.joinRoom({
      coveyRoomID: validRoom.coveyRoomID,
      userName: nanoid(),
    });

    const { coveySessionToken: validSessionToken2 } = await apiClient.joinRoom({
      coveyRoomID: validRoom.coveyRoomID,
      userName: nanoid(),
    });

    const { coveySessionToken: validSessionToken3 } = await apiClient.joinRoom({
      coveyRoomID: validRoom.coveyRoomID,
      userName: nanoid(),
    });
    const newUser1 = new Player('testUser');
    const newUser2 = new Player('testUser1');
    const newUser3 = new Player('testUser2');

    const newRoomJoinRequest1 = {
      userName: newUser1.userName,
      coveyRoomID: validRoom.coveyRoomID,
    };
    const newRoomJoinRequest2 = {
      userName: newUser2.userName,
      coveyRoomID: validRoom.coveyRoomID,
    };
    const newRoomJoinRequest3 = {
      userName: newUser3.userName,
      coveyRoomID: validRoom.coveyRoomID,
    };

    const socketConnected1 = TestUtils.createSocketClient(server, validSessionToken1, validRoom.coveyRoomID);
    const socketConnected2 = TestUtils.createSocketClient(server, validSessionToken2, validRoom.coveyRoomID);
    const socketConnected3 = TestUtils.createSocketClient(server, validSessionToken3, validRoom.coveyRoomID);

    await apiClient.joinRoom(newRoomJoinRequest1);
    await apiClient.joinRoom(newRoomJoinRequest2);
    await apiClient.joinRoom(newRoomJoinRequest3);

    await socketConnected1.socketConnected;
    await socketConnected2.socketConnected;
    await socketConnected3.socketConnected;

    // await socketConnected1.

  });
});
