import { Injectable, NgZone, inject } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';

@Injectable()
export class AttendanceLive {
    private readonly zone = inject(NgZone);
    status = 'Refreshing Automatically';
    private connection?: HubConnection;
    date?: string;
    private joining = false;

    follow(leagueId: number, refresh: () => void): void {
        if (this.connection) return;
        const connection = new HubConnectionBuilder().withUrl('/api/league-attendance-live')
            .withAutomaticReconnect([0, 2000, 10000]).configureLogging(LogLevel.None).build();
        this.connection = connection;
        connection.on('AttendanceChanged', () => { if (this.connection === connection) this.zone.run(refresh); });
        const join = async () => {
            try {
                const date = await connection.invoke<string>('Follow', leagueId);
                if (this.connection !== connection) return;
                this.date = date;
                this.status = 'Live';
                refresh();
            } catch {
                if (this.connection === connection) this.stop();
            }
        };
        connection.onreconnecting(() => {
            if (this.connection === connection) this.status = 'Reconnecting';
        });
        connection.onreconnected(join);
        connection.onclose(() => {
            if (this.connection === connection) this.stop();
        });
        void connection.start().then(join, () => {
            if (this.connection === connection) this.stop();
        });
    }

    updateDate(leagueId: number, date: string): void {
        const connection = this.connection;
        if (!this.date || this.date === date || this.joining || connection?.state !== HubConnectionState.Connected) return;
        this.joining = true;
        void connection.invoke<string>('Follow', leagueId).then(current => {
            if (this.connection === connection) this.date = current;
        }, () => {
            if (this.connection === connection) this.stop();
        }).finally(() => { this.joining = false; });
    }

    stop(): void {
        const connection = this.connection;
        this.connection = undefined;
        this.date = undefined;
        this.status = 'Refreshing Automatically';
        if (connection) void connection.stop().catch(() => {});
    }
}
