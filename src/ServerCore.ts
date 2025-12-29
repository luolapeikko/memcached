import packageJson from '../package.json' with {type: 'json'};

export class ServerCore {
	public static getVersion() {
		return `${packageJson.name}-${packageJson.version}`;
	}
}
