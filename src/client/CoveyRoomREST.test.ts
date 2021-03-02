import Express from 'express';
import CORS from 'cors';
import http from 'http';
import { AddressInfo } from 'net';

import addRoomRoutes from '../router/room';
import RoomServiceClient from './RoomServiceClient';
import { ConfigureTest, StartTest } from '../FaultManager';

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

      expect(allRooms.rooms).not.toContainEqual(room3Response); 
      expect(allRooms.rooms).toContainEqual(room2Response); 
      expect(allRooms.rooms).toContainEqual(room1Response); 
      
    });


    it.each(ConfigureTest('LMF'))('Allows for multiple rooms with the same friendlyName [%s]', async (testConfiguration: string) => {
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

      const allRooms = await apiClient.listRooms();

      expect(allRooms.rooms).toContainEqual(room1Response);
      expect(allRooms.rooms).toContainEqual(room2Response);
    });
  });

  describe('CoveyRoomDeleteAPI', () => {
    it.each(ConfigureTest('DRP'))('Throws an error if the password is invalid [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const createdRoom2 = await apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true });

      const deleteRequest2 = {
        coveyRoomID: createdRoom2.coveyRoomID,
        coveyRoomPassword: 'ijijij',
      };

      await expect( () => apiClient.deleteRoom(deleteRequest2)).rejects.toThrowError();
    });

    it.each(ConfigureTest('DRID'))('Throws an error if the roomID is invalid [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const createdRoom2 = await apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true });

      const deleteRequest2 = {
        coveyRoomID: 'ijijiji',
        coveyRoomPassword: createdRoom2.coveyRoomPassword,
      };

      await expect( () => apiClient.deleteRoom(deleteRequest2)).rejects.toThrow();
    });

    it.each(ConfigureTest('DRV'))('Deletes a room if given a valid password and room, no longer allowing it to be joined or listed [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const [createdRoom1, createdRoom2] = await Promise.all([
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
      ]);  
      
      const room1Response = {
        coveyRoomID: createdRoom1.coveyRoomID,
        coveyRoomPassword: createdRoom2.coveyRoomPassword,
      };
      const room2Response = {
        coveyRoomID: createdRoom2.coveyRoomID,
        coveyRoomPassword: createdRoom2.coveyRoomPassword,
      };

      const userJoinRequest = {
        userName: 'testuser',
        coveyRoomID: createdRoom2.coveyRoomID,
      };

      await apiClient.deleteRoom(room2Response);
      await expect( () => apiClient.joinRoom(userJoinRequest)).rejects.toThrowError();

 
      const listRes = await apiClient.listRooms();
      expect(listRes.rooms).not.toContainEqual(room1Response);
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

      const updateRequest = {
        coveyRoomID: createdRoom1.coveyRoomID,
        coveyRoomPassword: 'padfadf',
        friendlyName: 'newName',
        isPubliclyListed: true,
      };

      await expect( () => apiClient.updateRoom(updateRequest)).rejects.toThrow();
      const roomList = await apiClient.listRooms();
      expect(roomList.rooms).toContainEqual(room1Response);

    });
    it.each(ConfigureTest('UFV'))('Updates the friendlyName and visbility as requested [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const createdRoom1 = await apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: false });
      const createdRoom2 = await apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: false });
      
      const room1Response = {
        coveyRoomID: createdRoom1.coveyRoomID,
        friendlyName: 'newName',
      };

      const room2Response = {
        coveyRoomID: createdRoom2.coveyRoomID,
        friendlyName: testConfiguration,
      };

      const updateRequest1 = {
        coveyRoomID: createdRoom1.coveyRoomID,
        coveyRoomPassword: createdRoom1.coveyRoomPassword,
        friendlyName: 'newName',
        isPubliclyListed: true,
      };

      const updateRequest2 = {
        coveyRoomID: createdRoom2.coveyRoomID,
        coveyRoomPassword: createdRoom2.coveyRoomPassword,
        friendlyName: testConfiguration,
        isPubliclyListed: false,
      };
      
      await apiClient.updateRoom(updateRequest1);
      await apiClient.updateRoom(updateRequest2);

      const roomList = await apiClient.listRooms();
      expect(roomList.rooms).toContainEqual(room1Response);
      expect(roomList.rooms).not.toContainEqual(room2Response);
    });

    it.each(ConfigureTest('UFVU'))('Does not update the visibility if visibility is undefined [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const createdRoom1 = await apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: false });
      const createdRoom2 = await apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true });

      const numVisibleRoom = (await apiClient.listRooms()).rooms.length;

      const updateRequest = {
        coveyRoomID: createdRoom1.coveyRoomID,
        coveyRoomPassword: createdRoom1.coveyRoomPassword,
        friendlyName: 'newName',
      };

      const updateRequest2 = {
        coveyRoomID: createdRoom1.coveyRoomID,
        coveyRoomPassword: createdRoom1.coveyRoomPassword,
        friendlyName: 'newName',
        isPubliclyListed: undefined,
      };

      const updateRequest3 = {
        coveyRoomID: createdRoom2.coveyRoomID,
        coveyRoomPassword: createdRoom2.coveyRoomPassword,
        friendlyName: 'newName2',
        isPubliclyListed: undefined,
      };

      const room1Response = {
        coveyRoomID: createdRoom1.coveyRoomID,
        friendlyName: 'newName',
      };

      const newRoom2Response = {
        coveyRoomID: createdRoom1.coveyRoomID,
        friendlyName: 'newName2',
      };
      
      await apiClient.updateRoom(updateRequest);
      await apiClient.updateRoom(updateRequest2);
      await apiClient.updateRoom(updateRequest3);

      const list = await apiClient.listRooms();

      expect(numVisibleRoom).toStrictEqual(list.rooms.length);
      expect(list.rooms).not.toContainEqual(room1Response);
      expect(list.rooms).not.toContainEqual(newRoom2Response);

    });
  });

  describe('CoveyMemberAPI', () => {
    it.each(ConfigureTest('MNSR'))('Throws an error if the room does not exist [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

      const request = {
        userName: 'Me',
        coveyRoomID: 'noRoomWThisName',
      };
      await expect( () => apiClient.joinRoom(request)).rejects.toThrowError();

    });

    it.each(ConfigureTest('MJPP'))('Admits a user to a valid public or private room [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const [createdRoom1, createdRoom2] = await Promise.all([
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: true }),
        apiClient.createRoom({ friendlyName: testConfiguration, isPubliclyListed: false }),
      ]);  

      const newRoomRequest1 = {
        userName: 'user1',
        coveyRoomID: createdRoom1.coveyRoomID,
      };

      const newRoomRequest2 = {
        userName: 'user2',
        coveyRoomID: createdRoom2.coveyRoomID,
      };

      const response1 = await apiClient.joinRoom(newRoomRequest1);
      const response2 = await apiClient.joinRoom(newRoomRequest2);

      expect(response1).toHaveProperty('coveyUserID');
      expect(response2).toHaveProperty('coveyUserID');
    });
  });
});



