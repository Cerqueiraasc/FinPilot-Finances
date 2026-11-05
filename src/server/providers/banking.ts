export const SIMULATED_BANKING_LABEL = "Demonstração — sem conexão bancária real";

export interface BankConnection {
  id: string;
  institution: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  simulated: boolean;
}

export interface SyncedTransaction {
  externalId: string;
  date: string;
  description: string;
  signedAmountCents: number;
}

/** Contrato para um futuro parceiro autorizado de Open Finance (Fase 2). */
export interface BankingProvider {
  connect(userId: string, institution: string): Promise<BankConnection>;
  getConnections(userId: string): Promise<BankConnection[]>;
  syncTransactions(userId: string, connectionId: string): Promise<SyncedTransaction[]>;
  revokeConsent(userId: string, connectionId: string): Promise<void>;
}

/**
 * Simulação em memória, somente para demonstração. Não acessa banco algum,
 * não recebe credenciais e não é exposta como integração real.
 */
export class MockBankingProvider implements BankingProvider {
  private connections = new Map<string, BankConnection[]>();

  async connect(userId: string, institution: string): Promise<BankConnection> {
    const connection: BankConnection = {
      id: `mock-${crypto.randomUUID()}`,
      institution: `${institution} (${SIMULATED_BANKING_LABEL})`,
      status: "ACTIVE",
      simulated: true,
    };
    this.connections.set(userId, [...(this.connections.get(userId) ?? []), connection]);
    return connection;
  }

  async getConnections(userId: string): Promise<BankConnection[]> {
    return this.connections.get(userId) ?? [];
  }

  async syncTransactions(userId: string, connectionId: string): Promise<SyncedTransaction[]> {
    const connection = (this.connections.get(userId) ?? []).find((item) => item.id === connectionId);
    if (!connection || connection.status !== "ACTIVE") return [];
    return [
      {
        externalId: `${connectionId}-1`,
        date: "2026-01-15",
        description: "Lançamento fictício de demonstração",
        signedAmountCents: -1000,
      },
    ];
  }

  async revokeConsent(userId: string, connectionId: string): Promise<void> {
    const connection = (this.connections.get(userId) ?? []).find((item) => item.id === connectionId);
    if (connection) connection.status = "REVOKED";
  }
}
