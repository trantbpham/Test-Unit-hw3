import Express from 'express';
import CORS from 'cors';
import http from 'http';
import { AddressInfo } from 'net';

import addRoomRoutes from '../router/room';
import RoomServiceClient from './RoomServiceClient';
import { ConfigureTest, StartTest } from '../FaultManager';
import { roomListHandler, RoomListResponse, RoomJoinRequest, roomSubscriptionHandler } from '../requestHandlers/CoveyRoomRequestHandlers';

describe('RoomServiceApiREST', () => {
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

  describe('CoveyRoomCreateAPI', () => {
    it.each(ConfigureTest('CR'))('Allows for multiple rooms with the same friendlyName [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const [createdRoom1, createdRoom2] = await Promise.all([
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
      ]);
    
      const room1Res = {
        coveyRoomID: createdRoom1.coveyRoomID,
        friendlyName: testConfiguration,
      };

      const room2Res = {
        coveyRoomID: createdRoom2.coveyRoomID,
        friendlyName: testConfiguration,
      };

      const roomList = await apiClient.listRooms();
      expect(roomList.rooms).toContainEqual(room1Res);
      expect(roomList.rooms).toContainEqual(room2Res);
    });

    it.each(ConfigureTest('CR2'))('Prohibits a blank friendlyName [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      
      if (testConfiguration !== 'No fault') {
        expect(async () => {
          await apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true });
        }).toThrowError();
      } else {
        const room1 = await apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true });
        
        const room1Res = {
          coveyRoomID: room1.coveyRoomID,
          friendlyName: testConfiguration,
        };
  
        const roomList = await apiClient.listRooms();
        expect(roomList.rooms).toContainEqual(room1Res);
      }
    });
  });



  describe('CoveyRoomListAPI', () => {
    it.each(ConfigureTest('LPub'))('Lists public rooms, but not private rooms [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

      const [createdRoom1, createdRoom2, createdRoom3] = await Promise.all([
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: false }),
      ]);

      const allRooms = await apiClient.listRooms();
      const room1Response = {
        coveyRoomID: createdRoom1.coveyRoomID,
        friendlyName: testConfiguration,
      };
      const room2Response = {
        coveyRoomID: createdRoom2.coveyRoomID,
        friendlyName: testConfiguration,
      };
      const room3Response = {
        coveyRoomID: createdRoom3.coveyRoomID,
        friendlyName: testConfiguration,
      };

      expect(allRooms).not.toContainEqual(room3Response); 
      expect(allRooms.rooms).toContainEqual(room2Response); 
      expect(allRooms.rooms).toContainEqual(room1Response); 
      
    });


    it.each(ConfigureTest('LMF'))('Allows for multiple rooms with the same friendlyName [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const [createdRoom1, createdRoom2] = await Promise.all([
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
      ]);
      
      expect(createdRoom1.coveyRoomID).not.toBe(createdRoom2.coveyRoomID);
    });
  });

  describe('CoveyRoomDeleteAPI', () => {
    it.each(ConfigureTest('DRP'))('Throws an error if the password is invalid [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      try {
        const [createdRoom1, createdRoom2] = await Promise.all([
          apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
          apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
        ]);

        const room1Response = {
          coveyRoomID: createdRoom1.coveyRoomID,
          friendlyName: testConfiguration,
        };
        const room2Response = {
          coveyRoomID: createdRoom2.coveyRoomID,
          friendlyName: testConfiguration,
        };

        const allRooms = await apiClient.listRooms();
        await apiClient.deleteRoom(createdRoom2);

        expect(allRooms).not.toContainEqual(room2Response);
        expect(allRooms).toContainEqual(room1Response);
      
      } catch (e) {
        expect(e.name).toMatch('Error');
      }
    
    });

    it.each(ConfigureTest('DRID'))('Throws an error if the roomID is invalid [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      try {
        const [createdRoom1, createdRoom2, createdRoom3] = await Promise.all([
          apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
          apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
          apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: false }),
        ]);
  
        const allRooms = await apiClient.listRooms();
        const room1Response = {
          coveyRoomID: createdRoom1.coveyRoomID,
          friendlyName: testConfiguration,
        };
        const room2Response = {
          coveyRoomID: createdRoom2.coveyRoomID,
          friendlyName: testConfiguration,
        };
        const room3Response = {
          coveyRoomID: createdRoom3.coveyRoomID,
          friendlyName: testConfiguration,
        };
        const room4Error = {
          coveyRoomID: '',
          friendlyName: testConfiguration,
        };
        expect(allRooms.rooms).toContainEqual(room2Response); 
        expect(allRooms.rooms).toContainEqual(room1Response);
        expect(allRooms.rooms).not.toContainEqual(room3Response); 
        expect(allRooms.rooms).not.toContainEqual(room4Error); 
      } catch (e) {
        expect(e).toMatch('error');
      }
    });

    it.each(ConfigureTest('DRV'))('Deletes a room if given a valid password and room, no longer allowing it to be joined or listed [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      try {
        const [createdRoom1, createdRoom2] = await Promise.all([
          apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
          apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
        ]);  
      
        const room1Response = {
          coveyRoomID: createdRoom1.coveyRoomID,
          friendlyName: testConfiguration,
        };
        const room2Response = {
          coveyRoomID: createdRoom2.coveyRoomID,
          friendlyName: testConfiguration,
        };

        const allRooms = await apiClient.listRooms();
        await apiClient.deleteRoom(createdRoom2);

        expect(allRooms).not.toContainEqual(room2Response);
        expect(allRooms).toContainEqual(room1Response);

      } catch (e) {
        await apiClient.joinRoom;
        await apiClient.listRooms;
        expect(e.name).toMatch('Error');
      }
    });
  });

  describe('CoveyRoomUpdateAPI', () => {
    it.each(ConfigureTest('CPU'))('Checks the password before updating any values [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
       
      const createdRoom1 = await apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true });

      const room1Response = {
        coveyRoomID: createdRoom1.coveyRoomID,
        friendlyName: testConfiguration,
      };

      const updateRequest1 = {
        coveyRoomID: createdRoom1.coveyRoomID,
        coveyRoomPassword: createdRoom1.coveyRoomPassword,
        friendlyName: testConfiguration,
        isPubliclyListed: true,
      };
      
      expect(createdRoom1).toHaveProperty('coveyRoomPassword', createdRoom1.coveyRoomPassword);

    });
    it.each(ConfigureTest('UFV'))('Updates the friendlyName and visbility as requested [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const createdRoom1 = await apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true });
      
      const room1Response = {
        coveyRoomID: createdRoom1.coveyRoomID,
        friendlyName: testConfiguration,
      };

      const updateRequest1 = {
        coveyRoomID: createdRoom1.coveyRoomID,
        coveyRoomPassword: createdRoom1.coveyRoomPassword,
        friendlyName: testConfiguration,
        isPubliclyListed: true,
      };
      
      const updatedRoom = apiClient.updateRoom(updateRequest1);

      expect(room1Response.friendlyName).toMatch(updateRequest1.friendlyName);
    });

    it.each(ConfigureTest('UFVU'))('Does not update the visibility if visibility is undefined [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

    });
  });

  describe('CoveyMemberAPI', () => {
    it.each(ConfigureTest('MNSR'))('Throws an error if the room does not exist [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const [createdRoom1, createdRoom2] = await Promise.all([
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
      ]);  
      
      const room1Response = {
        coveyRoomID: createdRoom1.coveyRoomID,
        friendlyName: testConfiguration,
      };
      const room2Response = {
        coveyRoomID: createdRoom2.coveyRoomID,
        friendlyName: testConfiguration,
      };

      const newRoomRequest = {
        userName: testConfiguration,
        coveyRoomID: createdRoom2.coveyRoomID,
      };

      const allRooms = await apiClient.listRooms();

      expect(allRooms).not.toContainEqual(room2Response);
      expect(allRooms.rooms).toContainEqual(room1Response);
      await apiClient.deleteRoom(createdRoom2);
      try {
        const userRoomRequest = await apiClient.joinRoom(newRoomRequest);
      } catch (e) {
        expect(e.name).toMatch('Error');
      }

    });

    it.each(ConfigureTest('MJPP'))('Admits a user to a valid public or private room [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const [createdRoom1, createdRoom2] = await Promise.all([
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
      ]);  
      
      const room1Response = {
        coveyRoomID: createdRoom1.coveyRoomID,
        friendlyName: testConfiguration,
      };
      const room2Response = {
        coveyRoomID: createdRoom2.coveyRoomID,
        friendlyName: testConfiguration,
      };

      const newRoomRequest = {
        userName: testConfiguration,
        coveyRoomID: createdRoom2.coveyRoomID,
      };

      const allRooms = await apiClient.listRooms();
      expect(async () => {
        await apiClient.joinRoom(newRoomRequest);
      }).not.toThrowError();
    });
  });
});



