import { DefaultOptions, Endpoints, ValidIfSerializable } from '../types';

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export class ShardingUtils {
	public static generateNonce() {
		let randomStr = '';

		do {
			randomStr += characters.charAt(Math.floor(Math.random() * characters.length));
		} while (randomStr.length < 10);

		return randomStr;
	}

	public static chunkArray<T>(array: T[], chunkSize: number): T[][] {
		const R = [] as T[][];

		for (let i = 0; i < array.length; i += chunkSize) {
			R.push(array.slice(i, i + chunkSize));
		}

		return R;
	}

	public static delayFor(ms: number) {
		return new Promise<void>((resolve) => {
			setTimeout(resolve, ms);
		});
	}

	public static isSerializable<T>(value: T): value is T & ValidIfSerializable<T> {
		if (typeof value === 'object' && value !== null && value.constructor !== Object && value.constructor !== Array) return false;
		if (typeof value === 'function') return false;
		if (typeof value === 'symbol') return false;

		return true;
	}

	public static removeNonExisting<T>(array: (T | undefined)[]): T[] {
		return array.reduce((acc: T[], item: T | undefined) => {
			if (item !== undefined && item !== null) acc.push(item);
			return acc;
		}, []);
	}

	public static makePlainError(err: Error) {
		const removeStuff = <T extends string>(v: T) => v.replace(/(\n|\r|\t)/g, '').replace(/( )+/g, ' ').replace(/(\/\/.*)/g, '');

		return {
			name: removeStuff(err.name),
			message: removeStuff(err.message),
			stack: removeStuff(err.stack?.replace(': ' + err.message, '') || ''),
		};
	}

	public static mergeObjects<T extends object>(main: Partial<T>, toMerge: Partial<T>): T {
		for (const key in toMerge) {
			if (toMerge[key] && typeof toMerge[key] === 'object') {
				if (!main[key]) Object.assign(main, { [key]: {} });
				this.mergeObjects(main[key] as Record<string, unknown>, toMerge[key] as Record<string, unknown>);
			} else {
				Object.assign(main, { [key]: toMerge[key] });
			}
		}

		return main as T;
	}

	public static shardIdForGuildId(guildId: string, totalShards: number) {
		if (!guildId?.match(/^[0-9]+$/)) throw new Error('No valid GuildId Provided.');
		if (isNaN(totalShards) || totalShards < 1) throw new Error('No valid TotalShards Provided.');

		const shard = Number(BigInt(guildId) >> BigInt(22)) % totalShards;
		if (shard < 0) throw new Error('SHARD_MISCALCULATION_SHARDID_SMALLER_THAN_0 ' + `Calculated Shard: ${shard}, guildId: ${guildId}, totalShards: ${totalShards}`);

		return shard;
	}

	public static clusterIdForShardId(shardId: string, totalShards: number, totalClusters: number) {
		if (!shardId?.match(/^[0-9]+$/)) throw new Error('No valid ShardId Provided.');
		if (isNaN(totalShards) || totalShards < 1) throw new Error('No valid TotalShards Provided.');
		if (isNaN(totalClusters) || totalClusters < 1) throw new Error('No valid TotalClusters Provided.');

		const middlePart = Number(shardId) === 0 ? 0 : Number(shardId) / Math.ceil(totalShards / totalClusters);
		return Number(shardId) === 0 ? 0 : (Math.ceil(middlePart) - (middlePart % 1 !== 0 ? 1 : 0));
	}

	public static clusterIdForGuildId(guildId: string, totalShards: number, totalClusters: number) {
		if (!guildId?.match(/^[0-9]+$/)) throw new Error('No valid GuildId Provided.');
		if (isNaN(totalShards) || totalShards < 1) throw new Error('No valid TotalShards Provided.');
		if (isNaN(totalClusters) || totalClusters < 1) throw new Error('No valid TotalClusters Provided.');

		const shardId = this.shardIdForGuildId(guildId, totalShards);
		return this.clusterIdForShardId(shardId.toString(), totalShards, totalClusters);
	}

	public static async getRecommendedShards(token: string, guildsPerShard = 1000) {
		if (!token) throw new Error('DISCORD_TOKEN_MISSING | No token was provided to ClusterManager options.');

		const response = await fetch(`${DefaultOptions.http.api}/v${DefaultOptions.http.version}${Endpoints.botGateway}`, {
			method: 'GET',
			headers: { Authorization: `Bot ${token.replace(/^Bot\s*/i, '')}` },
		}).then((res) => {
			if (res.ok) return res.json() as Promise<{ shards: number }>;
			if (res.status === 401) throw new Error('DISCORD_TOKEN_INVALID | The provided token was invalid.');

			throw res;
		});

		return response.shards * (1000 / guildsPerShard);
	}
}
