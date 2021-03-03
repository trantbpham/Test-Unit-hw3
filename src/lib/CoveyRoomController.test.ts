import { mock, mockReset } from 'jest-mock-extended';
import { Socket } from 'socket.io';
import { nanoid } from 'nanoid';
import TwilioVideo from './TwilioVideo';
import CoveyRoomListener from '../types/CoveyRoomListener';
import CoveyRoomController from './CoveyRoomController';
import CoveyRoomsStore from './CoveyRoomsStore';
import Player from '../types/Player';
import { roomSubscriptionHandler, RoomUpdateRequest } from '../requestHandlers/CoveyRoomRequestHandlers';
import * as TestUtils from '../TestUtils';
import { ConfigureTest, StartTest } from '../FaultManager';
import { UserLocation, Direction } from '../CoveyTypes';
import PlayerSession from '../types/PlayerSession';

// Set up a manual mock for the getTokenForRoom function in TwilioVideo
jest.mock('./TwilioVideo');
const mockGetTokenForRoom = jest.fn();
// eslint-disable-next-line
// @ts-ignore it's a mock
TwilioVideo.getInstance = () => ({
  getTokenForRoom: mockGetTokenForRoom,
});

const mockListeners = [mock<CoveyRoomListener>(),
  mock<CoveyRoomListener>(),
  mock<CoveyRoomListener>()];





describe('CoveyRoomController', () => {
  beforeEach(() => {
    // Reset any logged invocations of getTokenForRoom before each test
    mockGetTokenForRoom.mockClear();
  });

  it.each(ConfigureTest('CRCC'))('constructor should set the friendlyName property [%s]', (testConfiguration: string) => {
    StartTest(testConfiguration);
    const newRoom = new CoveyRoomController('testFriendlyName', true);

    expect(newRoom.friendlyName).toBe('testFriendlyName');
  });


  describe('addPlayer', () => {
    it.each(ConfigureTest('CRCAP'))('should use the coveyRoomID and player ID properties when requesting a video token [%s]',
      async (testConfiguration: string) => {
        StartTest(testConfiguration);
        
        const testPlayer = new Player('testUser');
        const testRoomController2 = new CoveyRoomController('testRoomID', true);
        testRoomController2.addRoomListener(mockListeners[0]);
        testRoomController2.addRoomListener(mockListeners[1]);
        testRoomController2.addRoomListener(mockListeners[2]);

        testRoomController2.addPlayer(testPlayer);
        expect(mockGetTokenForRoom).toHaveBeenCalledWith(testRoomController2.coveyRoomID, testPlayer.id);

      });
  });

  describe('room listeners and events', () => {
    const testPlayer = new Player('testUser');
    const testRoomController2 = new CoveyRoomController('testRoomID', true);
    testRoomController2.addRoomListener(mockListeners[0]);
    testRoomController2.addRoomListener(mockListeners[1]);
    testRoomController2.addRoomListener(mockListeners[2]);
    afterEach(() => jest.resetAllMocks());
    beforeEach(() => {
      mockListeners.forEach(mockReset);
    });
    
    it.each(ConfigureTest('RLEMV'))('should notify added listeners of player movement when updatePlayerLocation is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      
      const d: Direction = 'front';
      
      const newLocation = {
        x: 0,
        y: 2,
        moving: true,
        rotation: d,
      };

      await testRoomController2.addPlayer(testPlayer);
      testRoomController2.updatePlayerLocation(testPlayer, newLocation);
      testRoomController2.updatePlayerLocation(testPlayer, newLocation);
      testRoomController2.updatePlayerLocation(testPlayer, newLocation);

      expect(mockListeners[0].onPlayerMoved).toHaveBeenCalledWith(testPlayer);
      expect(mockListeners[1].onPlayerMoved).toHaveBeenCalledWith(testPlayer);
      expect(mockListeners[2].onPlayerMoved).toHaveBeenCalledWith(testPlayer);
    });


    it.each(ConfigureTest('RLEDC'))('should notify added listeners of player disconnections when destroySession is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

      const mockPlayerSession = new PlayerSession(testPlayer);

      testRoomController2.destroySession(mockPlayerSession);
      
      expect(mockListeners[0].onPlayerDisconnected).toHaveBeenCalledWith(testPlayer);
      expect(mockListeners[1].onPlayerDisconnected).toHaveBeenCalledWith(testPlayer);
      expect(mockListeners[2].onPlayerDisconnected).toHaveBeenCalledWith(testPlayer);

    });
    it.each(ConfigureTest('RLENP'))('should notify added listeners of new players when addPlayer is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

      await testRoomController2.addPlayer(testPlayer);
      
      expect(mockListeners[0].onPlayerJoined).toHaveBeenCalledWith(testPlayer);
      expect(mockListeners[1].onPlayerJoined).toHaveBeenCalledWith(testPlayer);
      expect(mockListeners[2].onPlayerJoined).toHaveBeenCalledWith(testPlayer);

    });
    it.each(ConfigureTest('RLEDE'))('should notify added listeners that the room is destroyed when disconnectAllPlayers is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

      await testRoomController2.addPlayer(testPlayer);
      expect(mockListeners[0].onRoomDestroyed).toHaveBeenCalledTimes(0);
      expect(mockListeners[1].onRoomDestroyed).toHaveBeenCalledTimes(0);
      expect(mockListeners[2].onRoomDestroyed).toHaveBeenCalledTimes(0);

      testRoomController2.disconnectAllPlayers();

      expect(mockListeners[0].onRoomDestroyed).toHaveBeenCalledTimes(1);
      expect(mockListeners[1].onRoomDestroyed).toHaveBeenCalledTimes(1);
      expect(mockListeners[2].onRoomDestroyed).toHaveBeenCalledTimes(1);
    });

    it.each(ConfigureTest('RLEMVN'))('should not notify removed listeners of player movement when updatePlayerLocation is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const d: Direction = 'front';
      
      const newLocation = {
        x: 0,
        y: 2,
        moving: true,
        rotation: d,
      };

      await testRoomController2.addPlayer(testPlayer);
      testRoomController2.updatePlayerLocation(testPlayer, newLocation);
      testRoomController2.updatePlayerLocation(testPlayer, newLocation);
      testRoomController2.updatePlayerLocation(testPlayer, newLocation);

      testRoomController2.removeRoomListener(mockListeners[0]);
      testRoomController2.removeRoomListener(mockListeners[1]);
      testRoomController2.removeRoomListener(mockListeners[2]);

      expect(mockListeners[0].onPlayerDisconnected).not.toHaveBeenCalled();
      expect(mockListeners[1].onPlayerDisconnected).not.toHaveBeenCalled();
      expect(mockListeners[2].onPlayerDisconnected).not.toHaveBeenCalled();

    });
    it.each(ConfigureTest('RLEDCN'))('should not notify removed listeners of player disconnections when destroySession is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

      const mockPlayerSession = new PlayerSession(testPlayer);

      testRoomController2.destroySession(mockPlayerSession);
      testRoomController2.disconnectAllPlayers();

      testRoomController2.removeRoomListener(mockListeners[0]);
      testRoomController2.removeRoomListener(mockListeners[1]);
      testRoomController2.removeRoomListener(mockListeners[2]);

      expect(mockListeners[0].onPlayerDisconnected).not.toHaveBeenCalled();
      expect(mockListeners[1].onPlayerDisconnected).not.toHaveBeenCalled();
      expect(mockListeners[2].onPlayerDisconnected).not.toHaveBeenCalled();


    });
    it.each(ConfigureTest('RLENPN'))('should not notify removed listeners of new players when addPlayer is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

      await testRoomController2.addPlayer(testPlayer);

      testRoomController2.removeRoomListener(mockListeners[0]);
      testRoomController2.removeRoomListener(mockListeners[1]);
      testRoomController2.removeRoomListener(mockListeners[2]);

      expect(mockListeners[0].onPlayerDisconnected).not.toHaveBeenCalled();
      expect(mockListeners[1].onPlayerDisconnected).not.toHaveBeenCalled();
      expect(mockListeners[2].onPlayerDisconnected).not.toHaveBeenCalled();


    });
    it.each(ConfigureTest('RLEDEN'))('should not notify removed listeners that the room is destroyed when disconnectAllPlayers is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      
      await testRoomController2.addPlayer(testPlayer);

      testRoomController2.disconnectAllPlayers();
      expect(mockListeners[0].onRoomDestroyed).not.toHaveBeenCalled();
      expect(mockListeners[1].onRoomDestroyed).not.toHaveBeenCalled();
      expect(mockListeners[2].onRoomDestroyed).not.toHaveBeenCalled();

    });
  });
  describe('roomSubscriptionHandler', () => {
    // afterEach(() => jest.resetAllMocks());
    /* Set up a mock socket, which you may find to be useful for testing the events that get sent back out to the client
    by the code in CoveyRoomController calling socket.emit.each(ConfigureTest(''))('event', payload) - if you pass the mock socket in place of
    a real socket, you can record the invocations of emit and check them.
     */
    const mockSocket = mock<Socket>();
    /*
    Due to an unfortunate design decision of Avery's, to test the units of CoveyRoomController
    that interact with the socket, we need to: 1. Get a CoveyRoomController from the CoveyRoomsStore, and then 2: call
    the roomSubscriptionHandler method. Ripley's provided some boilerplate code for you to make this a bit easier.
     */
    let testingRoom: CoveyRoomController;
    beforeEach(async () => {
      const roomName = `connectPlayerSocket tests ${nanoid()}`;
      // Create a new room to use for each test
      testingRoom = CoveyRoomsStore.getInstance().createRoom(roomName, false);
      // Reset the log on the mock socket
      mockReset(mockSocket);
    });
    it.each(ConfigureTest('SUBIDDC'))('should reject connections with invalid room IDs by calling disconnect [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
 
      const connectedPlayer = new Player(`test player ${nanoid()}`);
      const session = await testingRoom.addPlayer(connectedPlayer);
      TestUtils.setSessionTokenAndRoomID(testingRoom.friendlyName, session.sessionToken, mockSocket);
      roomSubscriptionHandler(mockSocket);

      expect(mockSocket.disconnect).toBeCalled();

     

      /* Hint: see the beforeEach in the 'with a valid session token' case to see an example of how to configure the
         mock socket and connect it to the room controller
       */

      // mock socket is the coveyRoomListener
      // setSessionTokenAndRoomID and pass in the wrong roomID or token and make sure it like catches




    });
    it.each(ConfigureTest('SUBKTDC'))('should reject connections with invalid session tokens by calling disconnect [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

      TestUtils.setSessionTokenAndRoomID(testingRoom.coveyRoomID, 'sdfkjl', mockSocket);
      roomSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalled(); 

      /* Hint: see the beforeEach in the 'with a valid session token' case to see an example of how to configure the
         mock socket and connect it to the room controller
       */
    });
    describe('with a valid session token', () => {
      /*
        Ripley says that you might find this helper code useful: it will create a valid session, configure the mock socket
        to identify itself with those tokens, and then calls the roomSubscriptionHandler on the mock socket.

        Your tests should perform operations on testingRoom, and make expectations about what happens to the mock socket.
       */
      let connectedPlayer;
      beforeEach(async () => {
        connectedPlayer = new Player(`test player ${nanoid()}`);
        const session = await testingRoom.addPlayer(connectedPlayer);
        TestUtils.setSessionTokenAndRoomID(testingRoom.coveyRoomID, session.sessionToken, mockSocket);
        roomSubscriptionHandler(mockSocket);

      });
      it.each(ConfigureTest('SUBNP'))('should add a room listener, which should emit "newPlayer" to the socket when a player joins [%s]', async (testConfiguration: string) => {
        StartTest(testConfiguration);

        const newTestPlayer = new Player('testUser');
        await testingRoom.addPlayer(newTestPlayer);
        expect(mockSocket.emit).toBeCalled(); 


      });
      it.each(ConfigureTest('SUBMV'))('should add a room listener, which should emit "playerMoved" to the socket when a player moves [%s]', async (testConfiguration: string) => {
        StartTest(testConfiguration);

        const newTestPlayer = new Player('testUser');
        const d: Direction = 'front';
      
        const newLocation = {
          x: 0,
          y: 2,
          moving: true,
          rotation: d,
        };


        testingRoom.updatePlayerLocation(newTestPlayer, newLocation);
        expect(mockSocket.emit).toBeCalled(); 

      });
      it.each(ConfigureTest('SUBDC'))('should add a room listener, which should emit "playerDisconnect" to the socket when a player disconnects [%s]', async (testConfiguration: string) => {
        StartTest(testConfiguration);

      });
      it.each(ConfigureTest('SUBRC'))('should add a room listener, which should emit "roomClosing" to the socket and disconnect it when disconnectAllPlayers is called [%s]', async (testConfiguration: string) => {
        StartTest(testConfiguration);

      });
      describe('when a socket disconnect event is fired', () => {
        /* Hint: find the on('disconnect') handler that CoveyRoomController registers on the socket, and then
           call that handler directly to simulate a real socket disconnecting.
           */
        it.each(ConfigureTest('SUBDCRL'))('should remove the room listener for that socket, and stop sending events to it [%s]', async (testConfiguration: string) => {
          StartTest(testConfiguration);
          const connectedPlayer1 = new Player(`test player ${nanoid()}`);
          const session = await testingRoom.addPlayer(connectedPlayer1);
          TestUtils.setSessionTokenAndRoomID(testingRoom.friendlyName, session.sessionToken, mockSocket);
          roomSubscriptionHandler(mockSocket);
    
          expect(mockSocket.disconnect).toBeCalled();
    
        });
        it.each(ConfigureTest('SUBDCSE'))('should destroy the session corresponding to that socket [%s]', async (testConfiguration: string) => {
          StartTest(testConfiguration);

        });
      });
      it.each(ConfigureTest('SUBMVL'))('should forward playerMovement events from the socket to subscribed listeners [%s]', async (testConfiguration: string) => {
        StartTest(testConfiguration);

        /* Hint: find the on('playerMovement') handler that CoveyRoomController registers on the socket, and then
           call that handler directly to simulate a real socket sending a user's movement event.
           */
      });
    });
  });
});
