export type BlockType = 'stone' | 'archer' | 'cannon' | 'king'
export type StabilityState = 'FALLING' | 'SETTLING' | 'STABLE' | 'UNSTABLE' | 'COLLAPSED'
export interface BlockStats {
  name: string; short: string; width: number; height: number
  mass: number; friction: number; color: number; description: string
}
export const BLOCK_TYPES: BlockType[] = ['stone', 'archer', 'cannon', 'king']
export const BLOCKS: Record<BlockType, BlockStats> = {
  stone: { name: 'Stone Wall', short: 'STONE', width: 180, height: 90, mass: 12, friction: .95, color: 0x9cb6ac, description: 'Heavy, wide & steady. A strong foundation.' },
  archer: { name: 'Archer Tower', short: 'ARCHER', width: 100, height: 150, mass: 6, friction: .8, color: 0x82bdaf, description: 'Anti-air arrows every 1.2s. Fires only when STABLE.' },
  cannon: { name: 'Cannon Balcony', short: 'CANNON', width: 200, height: 100, mass: 10, friction: .85, color: 0xc4a082, description: 'Ground artillery every 2.5s. Fires only when STABLE.' },
  king: { name: "King’s Chamber", short: 'THRONE', width: 210, height: 120, mass: 14, friction: .9, color: 0xe1bd73, description: 'Keep upright and STABLE to crown your castle!' },
}
export const STATE_COLORS: Record<StabilityState, number> = {
  FALLING: 0xabc5c9, SETTLING: 0xe8c77e, STABLE: 0x8bdbb0, UNSTABLE: 0xf1ad62, COLLAPSED: 0xe77c72,
}
export const GROUND_Y = 1120
export const PIXELS_PER_METRE = 30
