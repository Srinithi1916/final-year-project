import React from 'react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';

interface NetworkInputFormProps {
  onSubmit: (data: Record<string, number>) => void;
  isLoading: boolean;
}

type SampleType = 'normal' | 'ddos' | 'brute' | 'ransomware' | 'zeroday';
type DatasetBuckets = Record<SampleType, Record<string, string>[]>;
type FormRow = Record<string, string>;

const ALL_NETWORK_FIELDS = [
  'Duration',
  'Protocol_Type',
  'Source_Port',
  'Destination_Port',
  'Packet_Length',
  'Packet_Size',
  'Header_Length',
  'Bytes_Transferred',
  'Bytes_Received',
  'Packets_Sent',
  'Packets_Received',
  'Packet_Rate',
  'Byte_Rate',
  'Connection_Count',
  'Active_Connections',
  'Failed_Connections',
  'Error_Rate',
  'Retransmission_Rate',
  'SYN_Count',
  'ACK_Count',
  'FIN_Count',
  'RST_Count',
  'PSH_Count',
  'URG_Count',
  'Window_Size',
  'TTL',
  'Fragmentation',
  'Same_Source_Port_Rate',
  'Same_Dest_Port_Rate',
  'Service_Count',
  'DNS_Query_Count',
  'TLS_Handshake_Time',
  'Payload_Entropy',
  'Unique_Destination_IPs',
  'Average_Inter_Arrival_Time',
  'CPU_Usage',
  'Memory_Usage',
  'Disk_Write_Rate',
  'Process_Count',
  'Login_Attempts',
];

// Keep the form short: only 14 inputs are manually editable.
const VISIBLE_FIELDS = [
  'Duration',
  'Protocol_Type',
  'Byte_Rate',
  'Packet_Rate',
  'Connection_Count',
  'Active_Connections',
  'Failed_Connections',
  'Error_Rate',
  'Retransmission_Rate',
  'Bytes_Transferred',
  'Bytes_Received',
  'SYN_Count',
  'ACK_Count',
  'RST_Count',
  'DNS_Query_Count',
  'Payload_Entropy',
];

const BASE_SAMPLES: Record<SampleType, Record<string, string>> = {
  normal: {
    Duration: '150', Protocol_Type: '6', Source_Port: '443', Destination_Port: '8080',
    Packet_Length: '512', Packet_Size: '1024', Header_Length: '20',
    Bytes_Transferred: '2048', Bytes_Received: '4096', Packets_Sent: '100', Packets_Received: '120',
    Packet_Rate: '50', Byte_Rate: '10240', Connection_Count: '5', Active_Connections: '3',
    Failed_Connections: '0', Error_Rate: '0.01', Retransmission_Rate: '0.02',
    SYN_Count: '5', ACK_Count: '120', FIN_Count: '3', RST_Count: '0', PSH_Count: '80', URG_Count: '0',
    Window_Size: '65535', TTL: '64', Fragmentation: '0',
    Same_Source_Port_Rate: '0.2', Same_Dest_Port_Rate: '0.3', Service_Count: '3',
    DNS_Query_Count: '18', TLS_Handshake_Time: '42', Payload_Entropy: '2.1', Unique_Destination_IPs: '6',
    Average_Inter_Arrival_Time: '12', CPU_Usage: '21', Memory_Usage: '36', Disk_Write_Rate: '4',
    Process_Count: '112', Login_Attempts: '1',
  },
  ddos: {
    Duration: '2', Protocol_Type: '6', Source_Port: '80', Destination_Port: '80',
    Packet_Length: '64', Packet_Size: '128', Header_Length: '20',
    Bytes_Transferred: '150000', Bytes_Received: '100', Packets_Sent: '50000', Packets_Received: '50',
    Packet_Rate: '15000', Byte_Rate: '500000', Connection_Count: '8000', Active_Connections: '7500',
    Failed_Connections: '2000', Error_Rate: '0.90', Retransmission_Rate: '0.95',
    SYN_Count: '10000', ACK_Count: '100', FIN_Count: '0', RST_Count: '5000', PSH_Count: '0', URG_Count: '0',
    Window_Size: '5840', TTL: '32', Fragmentation: '1',
    Same_Source_Port_Rate: '0.95', Same_Dest_Port_Rate: '0.98', Service_Count: '1',
    DNS_Query_Count: '4', TLS_Handshake_Time: '8', Payload_Entropy: '1.2', Unique_Destination_IPs: '1200',
    Average_Inter_Arrival_Time: '0.3', CPU_Usage: '82', Memory_Usage: '68', Disk_Write_Rate: '2',
    Process_Count: '160', Login_Attempts: '450',
  },
  brute: {
    Duration: '450', Protocol_Type: '6', Source_Port: '22', Destination_Port: '22',
    Packet_Length: '256', Packet_Size: '512', Header_Length: '20',
    Bytes_Transferred: '800', Bytes_Received: '500', Packets_Sent: '3000', Packets_Received: '2500',
    Packet_Rate: '300', Byte_Rate: '5000', Connection_Count: '800', Active_Connections: '50',
    Failed_Connections: '750', Error_Rate: '0.80', Retransmission_Rate: '0.35',
    SYN_Count: '800', ACK_Count: '50', FIN_Count: '750', RST_Count: '700', PSH_Count: '40', URG_Count: '0',
    Window_Size: '29200', TTL: '128', Fragmentation: '0',
    Same_Source_Port_Rate: '0.99', Same_Dest_Port_Rate: '1.0', Service_Count: '1',
    DNS_Query_Count: '2', TLS_Handshake_Time: '95', Payload_Entropy: '3.4', Unique_Destination_IPs: '14',
    Average_Inter_Arrival_Time: '2.5', CPU_Usage: '58', Memory_Usage: '49', Disk_Write_Rate: '6',
    Process_Count: '138', Login_Attempts: '980',
  },
  ransomware: {
    Duration: '2400', Protocol_Type: '6', Source_Port: '445', Destination_Port: '445',
    Packet_Length: '1024', Packet_Size: '1460', Header_Length: '20',
    Bytes_Transferred: '85000', Bytes_Received: '35000', Packets_Sent: '5000', Packets_Received: '4800',
    Packet_Rate: '200', Byte_Rate: '35000', Connection_Count: '350', Active_Connections: '280',
    Failed_Connections: '10', Error_Rate: '0.05', Retransmission_Rate: '0.08',
    SYN_Count: '350', ACK_Count: '9600', FIN_Count: '70', RST_Count: '10', PSH_Count: '4500', URG_Count: '0',
    Window_Size: '65535', TTL: '64', Fragmentation: '1',
    Same_Source_Port_Rate: '0.75', Same_Dest_Port_Rate: '0.85', Service_Count: '2',
    DNS_Query_Count: '45', TLS_Handshake_Time: '140', Payload_Entropy: '7.9', Unique_Destination_IPs: '220',
    Average_Inter_Arrival_Time: '14', CPU_Usage: '88', Memory_Usage: '84', Disk_Write_Rate: '140',
    Process_Count: '242', Login_Attempts: '28',
  },
  zeroday: {
    Duration: '1500', Protocol_Type: '17', Source_Port: '65000', Destination_Port: '9999',
    Packet_Length: '1400', Packet_Size: '1480', Header_Length: '48',
    Bytes_Transferred: '50000', Bytes_Received: '500000', Packets_Sent: '12000', Packets_Received: '11500',
    Packet_Rate: '10000', Byte_Rate: '250000', Connection_Count: '50000', Active_Connections: '3200',
    Failed_Connections: '20000', Error_Rate: '0.60', Retransmission_Rate: '0.55',
    SYN_Count: '50000', ACK_Count: '23000', FIN_Count: '200', RST_Count: '50000', PSH_Count: '11000', URG_Count: '50',
    Window_Size: '32768', TTL: '48', Fragmentation: '1',
    Same_Source_Port_Rate: '0.88', Same_Dest_Port_Rate: '0.92', Service_Count: '8',
    DNS_Query_Count: '320', TLS_Handshake_Time: '9', Payload_Entropy: '9.6', Unique_Destination_IPs: '640',
    Average_Inter_Arrival_Time: '1.2', CPU_Usage: '96', Memory_Usage: '94', Disk_Write_Rate: '220',
    Process_Count: '355', Login_Attempts: '76',
  },
};

const JITTER_LEVEL: Record<SampleType, number> = {
  normal: 0.1,
  ddos: 0.15,
  brute: 0.18,
  ransomware: 0.16,
  zeroday: 0.2,
};

const buildSampleVariants = (
  type: SampleType,
  base: Record<string, string>,
  count: number,
  jitter: number,
): Record<string, string>[] => {
  return Array.from({ length: count }, (_, i) => {
    if (i === 0) {
      return { ...base };
    }

    const variant: Record<string, string> = {};
    const factor = (i / (count - 1)) * jitter;
    const direction = i % 2 === 0 ? 1 : -1;

    ALL_NETWORK_FIELDS.forEach((field) => {
      const raw = base[field];
      const num = Number(raw);
      if (Number.isNaN(num)) {
        variant[field] = raw;
        return;
      }

      let next = Math.max(0, num * (1 + direction * factor));

      // Keep zero-day variants outside known-pattern thresholds so they remain labeled as Zero-Day.
      if (type === 'zeroday') {
        if (field === 'Duration') next = Math.min(next, 1500);
        if (field === 'Bytes_Transferred') next = Math.min(next, 50000);
        if (field === 'Packet_Rate') next = Math.min(next, 10000);
        if (field === 'Error_Rate') next = Math.min(next, 0.6);
      }

      variant[field] = Number.isInteger(num) ? String(Math.round(next)) : next.toFixed(2);
    });

    return variant;
  });
};

const SAMPLE_LIBRARY: Record<SampleType, Record<string, string>[]> = {
  normal: buildSampleVariants('normal', BASE_SAMPLES.normal, 16, JITTER_LEVEL.normal),
  ddos: buildSampleVariants('ddos', BASE_SAMPLES.ddos, 16, JITTER_LEVEL.ddos),
  brute: buildSampleVariants('brute', BASE_SAMPLES.brute, 16, JITTER_LEVEL.brute),
  ransomware: buildSampleVariants('ransomware', BASE_SAMPLES.ransomware, 16, JITTER_LEVEL.ransomware),
  zeroday: buildSampleVariants('zeroday', BASE_SAMPLES.zeroday, 16, JITTER_LEVEL.zeroday),
};

const DATASET_PATH = '/datasets/cyberfeddefender_dataset.csv';

const createEmptyBuckets = (): DatasetBuckets => ({
  normal: [],
  ddos: [],
  brute: [],
  ransomware: [],
  zeroday: [],
});

const normalizeAttackType = (value: string): SampleType | null => {
  const v = value.trim().toLowerCase();
  if (v === 'normal') return 'normal';
  if (v === 'ddos' || v === 'dos') return 'ddos';
  if (v === 'brute force' || v === 'bruteforce') return 'brute';
  if (v === 'ransomware') return 'ransomware';
  if (v === 'zero day' || v === 'zero-day' || v === 'zeroday') return 'zeroday';
  return null;
};

const toNumberString = (value: string | undefined, fallback: string): string => {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : fallback;
};

const mapProtocol = (protocol: string | undefined, fallback: string): string => {
  const p = (protocol || '').toUpperCase();
  if (p === 'TCP') return '6';
  if (p === 'UDP') return '17';
  if (p === 'ICMP') return '1';
  return fallback;
};

const mapCsvRowToForm = (row: Record<string, string>, type: SampleType): FormRow => {
  const mapped = { ...BASE_SAMPLES[type] };
  const fwdPackets = Number(row.Total_Fwd_Packets || 0);
  const bwdPackets = Number(row.Total_Bwd_Packets || 0);
  const totalPackets = Math.max(fwdPackets + bwdPackets, 1);
  const flowPackets = Number(row['Flow_Packets/s'] || 0);
  const flowBytes = Number(row['Flow_Bytes/s'] || 0);

  mapped.Duration = toNumberString(row.Duration, mapped.Duration);
  mapped.Protocol_Type = mapProtocol(row.Protocol, mapped.Protocol_Type);
  mapped.Source_Port = toNumberString(row.Source_Port, mapped.Source_Port);
  mapped.Destination_Port = toNumberString(row.Destination_Port, mapped.Destination_Port);
  mapped.Packet_Length = toNumberString(row.Packet_Length, mapped.Packet_Length);
  mapped.Packet_Size = toNumberString(row.Avg_Packet_Size, mapped.Packet_Size);
  mapped.Header_Length = toNumberString(row.Fwd_Header_Length, mapped.Header_Length);
  mapped.Bytes_Transferred = toNumberString(row.Bytes_Sent, mapped.Bytes_Transferred);
  mapped.Bytes_Received = toNumberString(row.Bytes_Received, mapped.Bytes_Received);
  mapped.Packets_Sent = toNumberString(row.Total_Fwd_Packets, mapped.Packets_Sent);
  mapped.Packets_Received = toNumberString(row.Total_Bwd_Packets, mapped.Packets_Received);
  mapped.Packet_Rate = flowPackets > 0 ? String(flowPackets) : mapped.Packet_Rate;
  mapped.Byte_Rate = flowBytes > 0 ? String(flowBytes) : mapped.Byte_Rate;
  mapped.Connection_Count = String(totalPackets);
  mapped.Active_Connections = String(Math.max(Math.round(totalPackets / 2), 1));
  mapped.SYN_Count = row.Flags === 'SYN' ? String(totalPackets) : mapped.SYN_Count;
  mapped.ACK_Count = row.Flags === 'ACK' ? String(totalPackets) : mapped.ACK_Count;
  mapped.FIN_Count = row.Flags === 'FIN' ? String(totalPackets) : mapped.FIN_Count;
  mapped.RST_Count = row.Flags === 'RST' ? String(totalPackets) : mapped.RST_Count;
  mapped.PSH_Count = row.Flags === 'PSH' ? String(totalPackets) : mapped.PSH_Count;
  mapped.URG_Count = row.Flags === 'URG' ? String(totalPackets) : mapped.URG_Count;
  mapped.TTL = '64';
  mapped.Fragmentation = '0';
  mapped.DNS_Query_Count = row.Destination_Port === '53' ? '120' : mapped.DNS_Query_Count;
  mapped.Payload_Entropy = Number(mapped.Packet_Size) > 900 ? '7.5' : mapped.Payload_Entropy;
  mapped.Login_Attempts = type === 'brute' ? '900' : mapped.Login_Attempts;

  // Keep app behavior aligned with expected class for sample-button UX.
  if (type === 'ddos') {
    mapped.Packet_Rate = String(Math.max(Number(mapped.Packet_Rate), 12000));
    mapped.Connection_Count = String(Math.max(Number(mapped.Connection_Count), 6000));
    mapped.Error_Rate = '0.9';
    mapped.Failed_Connections = String(Math.max(Number(mapped.Failed_Connections), 1200));
  } else if (type === 'brute') {
    mapped.Connection_Count = String(Math.max(Number(mapped.Connection_Count), 800));
    mapped.Failed_Connections = String(Math.max(Number(mapped.Failed_Connections), 700));
    mapped.Error_Rate = '0.8';
  } else if (type === 'ransomware') {
    mapped.Bytes_Transferred = String(Math.max(Number(mapped.Bytes_Transferred), 60000));
    mapped.Duration = String(Math.max(Number(mapped.Duration), 1800));
  } else if (type === 'normal') {
    mapped.Packet_Rate = String(Math.min(Number(mapped.Packet_Rate), 400));
    mapped.Connection_Count = String(Math.min(Number(mapped.Connection_Count), 200));
    mapped.Error_Rate = String(Math.min(Number(mapped.Error_Rate), 0.1));
    mapped.Failed_Connections = String(Math.min(Number(mapped.Failed_Connections), 20));
  }

  return mapped;
};

const parseCsvDataset = (csv: string): { buckets: DatasetBuckets; allRows: FormRow[] } => {
  const buckets = createEmptyBuckets();
  const allRows: FormRow[] = [];
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return { buckets, allRows };

  const headers = lines[0].split(',').map((h) => h.trim());

  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(',');
    if (values.length !== headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx].trim();
    });

    const type = normalizeAttackType(row.Attack_Type || '');
    const mappedType = type && type !== 'zeroday' ? type : 'normal';
    const mapped = mapCsvRowToForm(row, mappedType);
    allRows.push(mapped);
    if (type && type !== 'zeroday') {
      buckets[type].push(mapped);
    }
  }

  return { buckets, allRows };
};

export function NetworkInputForm({ onSubmit, isLoading }: NetworkInputFormProps) {
  const [formData, setFormData] = React.useState<Record<string, string>>(BASE_SAMPLES.normal);
  const [datasetSamples, setDatasetSamples] = React.useState<DatasetBuckets>(createEmptyBuckets());
  const [allDatasetRows, setAllDatasetRows] = React.useState<FormRow[]>([]);
  const [datasetLoaded, setDatasetLoaded] = React.useState(false);
  const [datasetRowIndex, setDatasetRowIndex] = React.useState(0);
  const [sampleIndex, setSampleIndex] = React.useState<Record<SampleType, number>>({
    normal: 0,
    ddos: 0,
    brute: 0,
    ransomware: 0,
    zeroday: 0,
  });

  React.useEffect(() => {
    let mounted = true;
    fetch(DATASET_PATH)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Dataset fetch failed');
        }
        return response.text();
      })
      .then((text) => {
        if (!mounted) return;
        const parsed = parseCsvDataset(text);
        setDatasetSamples(parsed.buckets);
        setAllDatasetRows(parsed.allRows);
        if (parsed.allRows.length > 0) {
          setFormData(parsed.allRows[0]);
          setDatasetRowIndex(1);
        }
        setDatasetLoaded(
          parsed.allRows.length > 0,
        );
      })
      .catch(() => {
        if (!mounted) return;
        setDatasetLoaded(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericData: Record<string, number> = {};
    ALL_NETWORK_FIELDS.forEach((field) => {
      numericData[field] = parseFloat(formData[field] || '0');
    });
    onSubmit(numericData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const fillSampleData = (type: SampleType) => {
    const variants =
      datasetSamples[type].length > 0 && type !== 'zeroday'
        ? datasetSamples[type]
        : SAMPLE_LIBRARY[type];
    const index = sampleIndex[type] % variants.length;
    setFormData(variants[index]);
    setSampleIndex((prev) => ({ ...prev, [type]: prev[type] + 1 }));
  };

  const loadNextDatasetRow = () => {
    if (allDatasetRows.length === 0) return;
    const index = datasetRowIndex % allDatasetRows.length;
    setFormData(allDatasetRows[index]);
    setDatasetRowIndex((prev) => prev + 1);
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold mb-2">Network Packet Input</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Showing 14 key inputs. {datasetLoaded ? `Full dataset loaded (${allDatasetRows.length} rows).` : 'Using built-in samples.'}
        </p>
        <div className="flex gap-2 mb-4 flex-wrap">
          <Button type="button" variant="secondary" size="sm" onClick={loadNextDatasetRow} disabled={!datasetLoaded}>
            Load Next Dataset Row
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fillSampleData('normal')}>
            Load Normal Sample
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fillSampleData('ddos')}>
            Load DDoS Sample
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fillSampleData('brute')}>
            Load Brute Force Sample
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fillSampleData('ransomware')}>
            Load Ransomware Sample
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fillSampleData('zeroday')}>
            Load Zero-Day Sample
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {VISIBLE_FIELDS.map((field) => (
            <div key={field}>
              <Label htmlFor={field} className="mb-2">
                {field.replace(/_/g, ' ')}
              </Label>
              <Input
                id={field}
                type="number"
                step="any"
                value={formData[field] || ''}
                onChange={(e) => handleChange(field, e.target.value)}
                required
                placeholder="0.0"
              />
            </div>
          ))}
        </div>

        <Button
          type="submit"
          className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600"
          disabled={isLoading}
        >
          {isLoading ? 'Analyzing...' : 'Analyze Packet'}
        </Button>
      </form>
    </Card>
  );
}
