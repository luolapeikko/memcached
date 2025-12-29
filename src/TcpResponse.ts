export class TcpResponse {
	public static STORED = 'STORED\r\n' as const;
	public static EXISTS = 'EXISTS\r\n' as const;
	public static END = 'END\r\n' as const;
	public static NOT_STORED = 'NOT_STORED\r\n' as const;
	public static DELETED = 'DELETED\r\n' as const;
	public static NOT_FOUND = 'NOT_FOUND\r\n' as const;
	public static TOUCHED = 'TOUCHED\r\n' as const;
	public static OK = 'OK\r\n' as const;
	public static createClientError(message: string): `CLIENT_ERROR ${string}\r\n` {
		return `CLIENT_ERROR ${message}\r\n`;
	}
	public static createServerError(message: string): `SERVER_ERROR ${string}\r\n` {
		return `SERVER_ERROR ${message}\r\n`;
	}
}
