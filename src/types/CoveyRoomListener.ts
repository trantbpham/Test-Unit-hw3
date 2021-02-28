import Player from './Player';

/**
 * A listener for player-related events in each room
 */
export default interface CoveyRoomListener {
  /**
   * Called when a player joins a room
   * @param newPlayer the new player
   */
  onPlayerJoined(newPlayer: Player): void;

  /**
   * Called when a player's location changes
   * @param movedPlayer the player that moved
   */
  onPlayerMoved(movedPlayer: Player): void;

  /**
   * Called when a player disconnects from the room
   * @param removedPlayer the player that disconnected
   */
  onPlayerDisconnected(removedPlayer: Player): void;

  /**
   * Called when a room is destroyed, causing all players to disconnect
   */
  onRoomDestroyed(): void;
}
