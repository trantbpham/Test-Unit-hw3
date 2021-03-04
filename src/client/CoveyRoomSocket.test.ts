import Express from 'express';
import CORS from 'cors';
import http from 'http';
import { AddressInfo } from 'net';
import { nanoid } from 'nanoid';
import * as TestUtils from '../TestUtils';

import addRoomRoutes from '../router/room';
import RoomServiceClient from './RoomServiceClient';
import { ConfigureTest, StartTest } from '../FaultManager';
import { createSocketClient } from '../TestUtils';
import Player from '../types/Player';
import { RoomJoinRequest } from '../requestHandlers/CoveyRoomRequestHandlers';


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

    // Connect with a valid session token, but an invalid room ID
    const { socketDisconnected, socketConnected } = TestUtils.createSocketClient(server, validSessionToken, nanoid());
    await socketConnected; // Make sure that the socket actually connects to the server
    await socketDisconnected; // If the server rejects our CoveyRoomID, it will disconnect our socket, and this promise will shortly resolve
    // This test will fail by timing out (in the event that the socket doesn't disconnect)

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
    const validRoom = await apiClient.createRoom({ isPubliclyListed: true, friendlyName: 'Test Room' });
    const { coveySessionToken: validSessionToken } = await apiClient.joinRoom({
      coveyRoomID: validRoom.coveyRoomID,
      userName: nanoid(),
    });

    // const updateMovement = await apiClient.updateRoom

    const { socketDisconnected, socketConnected } = TestUtils.createSocketClient(server, 'invalid stuffs', validRoom.coveyRoomID);
    await socketConnected; 
    await socketDisconnected;

  });
  it.each(ConfigureTest('CRSDC'))('Invalidates the user session after disconnection [%s]', async (testConfiguration: string) => {
    StartTest(testConfiguration);

    const validRoom = await apiClient.createRoom({ isPubliclyListed: true, friendlyName: 'Test Room' });



  });
  it.each(ConfigureTest('CRSNP'))('Informs all new players when a player joins [%s]', async (testConfiguration: string) => {
    StartTest(testConfiguration);
    const validRoom = await apiClient.createRoom({ isPubliclyListed: true, friendlyName: 'Test Room' });
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

    const { socketDisconnected, socketConnected } = TestUtils.createSocketClient(server, validRoom.coveyRoomID, nanoid());
    const socketConnected2 = TestUtils.createSocketClient(server, validRoom.coveyRoomID, nanoid());
    const socketConnected3 = TestUtils.createSocketClient(server, validRoom.coveyRoomID, nanoid());

    await socketConnected; // Make sure that the socket actually connects to the server
    const userJoins = await apiClient.joinRoom(newRoomJoinRequest1);
    await socketConnected2.socketConnected;
    const userJoins2 = await apiClient.joinRoom(newRoomJoinRequest2);
    await socketConnected3.socketConnected; // Make sure that the socket actually connects to the server
    const userJoins3 = await apiClient.joinRoom(newRoomJoinRequest3);

  });

  it.each(ConfigureTest('CRSDCN'))('Informs all players when a player disconnects [%s]', async (testConfiguration: string) => {
    StartTest(testConfiguration);

    const validRoom = await apiClient.createRoom({ isPubliclyListed: true, friendlyName: 'Test Room' });

  });
  it.each(ConfigureTest('CRSDCDX'))('Informs all players when the room is destroyed [%s]', async (testConfiguration: string) => {
    StartTest(testConfiguration);

    const validRoom = await apiClient.createRoom({ isPubliclyListed: true, friendlyName: 'Test Room' });

  });
});
