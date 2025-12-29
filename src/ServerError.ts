import {TcpResponse} from './TcpResponse';

export class ServerError extends Error {
	public constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'ServerError';
	}
	public toTcpString(): `SERVER_ERROR ${string}\r\n` {
		return TcpResponse.createServerError(this.message);
	}
}
