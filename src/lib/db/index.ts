import { Client, types } from 'cassandra-driver';
import { CASSANDRA_CONTACT_POINTS } from '../config';
import * as _ from 'lodash';

if (_.isEmpty(CASSANDRA_CONTACT_POINTS)) {
    console.error('CASSANDRA_CONTACT_POINTS environment variable not set');
    process.exit(1);
}

export const cassandra = new Client({ contactPoints: CASSANDRA_CONTACT_POINTS });

export type ReplicationType = 'SimpleStrategy' | 'NetworkTopologyStrategy';

export type NativeType = 'ascii' | 'bigint' | 'blob' | 'boolean' | 'counter' | 'date' | 'decimal' | 'double' | 'duration' | 'float' | 'inet' | 'int' | 'smallint' | 'text' | 'time' | 'timestamp' | 'timeuuid' | 'tinyint' | 'uuid' | 'varchar' | 'varint';

export class CQLType {
    constructor(public value: NativeType | [CQLType, CQLType] | { CQLType: CQLType } | Set<CQLType> | [CQLType]){}

    toString(): string {
        if (this.value instanceof Array && this.value.length === 2) return `tuple<${this.value[0]}, ${this.value[1]}>`;
        if (this.value instanceof Array && this.value.length === 1) return `list<${this.value[0]}>`;
        if (this.value instanceof Set) return `set<${this.value.values().next()}>`;
        if (this.value instanceof Object) {
            const key = Object.keys(this.value)[0];
            return `map<${key}, ${this.value[key]}>`;
        }
        return this.value;
    }
}

export class ColumnDefinition {

    constructor(public column_name: string, public cql_type: CQLType, public isStatic = false, public isPrimaryKey = false){}

    toString(): string {
        let ret = `${this.column_name} ${this.cql_type}`;
        ret += this.isStatic ? ' static' : '';
        ret += this.isPrimaryKey ? ' primary key': '';
        return ret;
    }
}

export abstract class ReplicationStrategy {
    class: ReplicationType;

    constructor(replicationType: ReplicationType) {
        this.class = replicationType;
    }

    toString(): string {
        return JSON.stringify(this).replace(/\"/g, '\'');
    }
}

export class SimpleStrategy extends ReplicationStrategy {

    /**
     * This determines the number of nodes that should contain a copy of each row.
     */
    replication_factor: string;

    constructor(replicationFactor: number) {
        super('SimpleStrategy');
        this.replication_factor = String(replicationFactor);
    }
}

export class NetworkTopologyStrategy extends ReplicationStrategy {

    constructor(dataCenterReplicationFactors: { [dataCenter: string]: number }) {
        super('NetworkTopologyStrategy');
        _.forEach(dataCenterReplicationFactors, (value, key) => {
            this[key] = String(value);
        });
    }
}

export class PartitionKey {
    keys: string[] = [];
    constructor(...columnName: string[]) {
        this.keys = columnName;
    }

    toString(): string {
        return this.keys.length === 1 ? this.keys[0] : `(${this.keys.join(', ')})`;
    }
}

export class ClusteringColumns extends PartitionKey {
    toString(): string {
        return this.keys.join(', ');
    }
}

export class PrimaryKey {
    constructor(public partitionKey: PartitionKey, public clusteringColumns?: ClusteringColumns) {}

    toString(): string {
        let ret = this.partitionKey.toString();
        ret += this.clusteringColumns ? `, ${this.clusteringColumns}` : '';
        return ret;
    }
}

export enum Direction {
    ASC = 1, DESC = -1
}

export interface ClusteringOrder {
    [columnName:string]: Direction
}

export class TableOptions {
    constructor(public clusteringOrder?: ClusteringOrder, ){}

    toString(): string {
        let ret = '';
        ret += this.clusteringOrder ? `CLUSTERING ORDER BY ${this.formatClusteringOrder()}` : '';
        return ret;
    }

    private formatClusteringOrder(): string {
        const values = _.map(this.clusteringOrder, (value, key) => {
            return `${key}: ${Direction[value]}`;
        });
        return `(${values.join(', ')})`;
    }
}

export function createKeyspace(name: string, replication: ReplicationStrategy, durableWrites = true): Promise<void> {
    const query = `CREATE KEYSPACE IF NOT EXISTS ${name} WITH replication = ${replication.toString()} AND durable_writes = ${durableWrites}`;
    return cassandra.execute(query).then(() => console.log(`Successfully prepared keyspace: ${name}`));
}

export function createTable(name: string, columnDefinitions: ColumnDefinition[], primaryKey?: PrimaryKey, tableOptions?) {
    let query = `CREATE TABLE IF NOT EXISTS ${name} (${columnDefinitions.map(def => def.toString()).join(', ')})`;
    query += primaryKey ? `PRIMARY KEY ${primaryKey}` : '';
    query += tableOptions ? `WITH ` : '';
    return cassandra.execute(query).then(() => console.log(`Successfully prepared table: ${name}`));
}

cassandra.connect()
    .then(() => {
        console.log('connected to cluster with %d host(s): %j', cassandra.hosts.length, cassandra.hosts.keys());
        console.log('Keyspaces: %j', Object.keys(cassandra.metadata['keyspaces']));
    }, err => {
        console.error('Unable to connect to cassandra cluster', err);
        return cassandra.shutdown();
    });