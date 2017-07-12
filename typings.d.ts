/* Place custom typings here */

import '@types/cassandra-driver';

declare module 'cassandra-driver' {
    interface Client {
        batch(queries: Array<string> | Array<{ query: string, params?: any }>, options: QueryOptions): Promise<types.ResultSet>;
        connect(): Promise<void>;
        execute(query: string, params?: any, options?: QueryOptions): Promise<types.ResultSet>;
        shutdown(): Promise<void>;
    }
}