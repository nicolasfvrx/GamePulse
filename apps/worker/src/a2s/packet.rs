use super::types::{A2SError, A2SInfoResponse};
use byteorder::{LittleEndian, ReadBytesExt};
use std::io::Cursor;

pub const A2S_HEADER: [u8; 4] = [0xFF, 0xFF, 0xFF, 0xFF];
pub const A2S_INFO_REQUEST_TYPE: u8 = 0x54; // 'T'
pub const A2S_INFO_RESPONSE_TYPE: u8 = 0x49; // 'I'
pub const A2S_CHALLENGE_RESPONSE_TYPE: u8 = 0x41; // 'A'

/// Builds an A2S_INFO UDP packet, optionally appending a 4-byte challenge.
pub fn build_info_packet(challenge: Option<[u8; 4]>) -> Vec<u8> {
    let mut packet = Vec::with_capacity(25 + if challenge.is_some() { 4 } else { 0 });
    packet.extend_from_slice(&A2S_HEADER);
    packet.push(A2S_INFO_REQUEST_TYPE);
    packet.extend_from_slice(b"Source Engine Query\0");
    if let Some(ch) = challenge {
        packet.extend_from_slice(&ch);
    }
    packet
}

fn read_null_terminated_string(cursor: &mut Cursor<&[u8]>) -> Result<String, A2SError> {
    let mut bytes = Vec::new();
    loop {
        match cursor.read_u8() {
            Ok(0) => break,
            Ok(b) => bytes.push(b),
            Err(_) => return Err(A2SError::MalformedString(cursor.position() as usize)),
        }
    }
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

/// Parses an A2S_INFO or A2S_CHALLENGE response buffer.
pub fn parse_info_response(buf: &[u8]) -> Result<A2SInfoResponse, A2SError> {
    if buf.len() < 5 {
        return Err(A2SError::PacketTooShort(buf.len()));
    }

    if buf[0..4] != A2S_HEADER {
        let mut hdr = [0u8; 4];
        hdr.copy_from_slice(&buf[0..4]);
        return Err(A2SError::InvalidHeader(hdr));
    }

    let response_type = buf[4];

    // Check if server is challenging us
    if response_type == A2S_CHALLENGE_RESPONSE_TYPE {
        if buf.len() < 9 {
            return Err(A2SError::PacketTooShort(buf.len()));
        }
        let mut challenge = [0u8; 4];
        challenge.copy_from_slice(&buf[5..9]);
        return Err(A2SError::ChallengeRequired(challenge));
    }

    if response_type != A2S_INFO_RESPONSE_TYPE {
        return Err(A2SError::InvalidResponseType(response_type));
    }

    let mut cursor = Cursor::new(&buf[5..]);

    let protocol = cursor.read_u8().map_err(|_| A2SError::PacketTooShort(buf.len()))?;
    let name = read_null_terminated_string(&mut cursor)?;
    let map = read_null_terminated_string(&mut cursor)?;
    let folder = read_null_terminated_string(&mut cursor)?;
    let game = read_null_terminated_string(&mut cursor)?;
    let app_id = cursor.read_u16::<LittleEndian>().unwrap_or(0);
    let players = cursor.read_u8().unwrap_or(0);
    let max_players = cursor.read_u8().unwrap_or(60);
    let bots = cursor.read_u8().unwrap_or(0);
    let server_type = cursor.read_u8().unwrap_or(b'd');
    let environment = cursor.read_u8().unwrap_or(b'l');
    let visibility = cursor.read_u8().unwrap_or(0);
    let vac = cursor.read_u8().unwrap_or(0);

    let version = read_null_terminated_string(&mut cursor).ok();

    // Check optional EDF (Extra Data Flag)
    let mut game_port = None;
    if let Ok(edf) = cursor.read_u8() {
        if (edf & 0x80) != 0 {
            if let Ok(port) = cursor.read_u16::<LittleEndian>() {
                game_port = Some(port);
            }
        }
    }

    Ok(A2SInfoResponse {
        protocol,
        name,
        map,
        folder,
        game,
        app_id,
        players,
        max_players,
        bots,
        server_type,
        environment,
        visibility,
        vac,
        version,
        game_port,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_info_packet_without_challenge() {
        let pkt = build_info_packet(None);
        assert_eq!(&pkt[0..4], &A2S_HEADER);
        assert_eq!(pkt[4], A2S_INFO_REQUEST_TYPE);
        assert_eq!(&pkt[5..], b"Source Engine Query\0");
    }

    #[test]
    fn test_build_info_packet_with_challenge() {
        let challenge = [0x12, 0x34, 0x56, 0x78];
        let pkt = build_info_packet(Some(challenge));
        assert_eq!(&pkt[pkt.len() - 4..], &challenge);
    }

    #[test]
    fn test_parse_challenge_response() {
        let raw = vec![0xFF, 0xFF, 0xFF, 0xFF, 0x41, 0xAA, 0xBB, 0xCC, 0xDD];
        let res = parse_info_response(&raw);
        match res {
            Err(A2SError::ChallengeRequired(ch)) => {
                assert_eq!(ch, [0xAA, 0xBB, 0xCC, 0xDD]);
            }
            _ => panic!("Expected ChallengeRequired error"),
        }
    }
}
