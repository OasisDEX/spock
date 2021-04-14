import { ethers } from 'ethers'

// NOTE: this is NOT DsNote abi! This was modified to be non-anon event with dummy name because we can't parse anon events
const logNoteAbi = [
  {
    inputs: [
      { indexed: true, name: 'sig', type: 'bytes4' },
      { indexed: true, name: 'guy', type: 'address' },
      { indexed: true, name: 'foo', type: 'bytes32' },
      { indexed: true, name: 'bar', type: 'bytes32' },
      { indexed: false, name: 'wad', type: 'uint256' },
      { indexed: false, name: 'fax', type: 'bytes' },
    ],
    name: 'LogNote',
    type: 'event',
  },
]

const logNoteIface = new ethers.utils.Interface(logNoteAbi)

export function tryParseDsNote(topics: string[], data: string): ReturnType<typeof logNoteIface.parseLog> | undefined {
  try {
    return logNoteIface.parseLog({
      data: data,
      topics: [logNoteIface.events.LogNote.topic, ...topics],
    })
  } catch {}
}

const logNoteVer2Abi = [
  {
    inputs: [
      { indexed: true, name: 'sig', type: 'bytes4' },
      { indexed: true, name: 'guy', type: 'address' },
      { indexed: true, name: 'foo', type: 'bytes32' },
      { indexed: true, name: 'bar', type: 'bytes32' },
      { indexed: false, name: 'fax', type: 'bytes' },
    ],
    name: 'LogNote',
    type: 'event',
  },
]

const logNoteVer2Iface = new ethers.utils.Interface(logNoteVer2Abi)
export function tryParseDsNoteVer2(
  topics: string[],
  data: string,
): ReturnType<typeof logNoteIface.parseLog> | undefined {
  try {
    return logNoteVer2Iface.parseLog({
      data: data,
      topics: [logNoteVer2Iface.events.LogNote.topic, ...topics],
    })
  } catch (e) {}
}
