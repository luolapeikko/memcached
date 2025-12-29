import {TcpResponse} from './TcpResponse';

export class ClientError extends Error {
	public constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'ClientError';
	}
	public toTcpString(): `CLIENT_ERROR ${string}\r\n` {
		return TcpResponse.createClientError(this.message);
	}
}
