// Pastikan port-nya sesuai dengan port backend kamu (3001)
const API_URL = 'https://geometric-api-683589783585.asia-southeast2.run.app/api';

export interface SuitabilityWeights {
  kepadatanPenduduk: number;
  dayaBeli: number;
  aksesibilitas: number;
  kepadatanKompetitor: number;
}

export const fetchLocationAnalysis = async (lat: number, lng: number, weights: SuitabilityWeights) => {
  try {
    const response = await fetch(`${API_URL}/locations/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lat, lng, weights }),
    });

    if (!response.ok) {
      throw new Error('Gagal mengambil data analisis dari server');
    }

    return await response.json();
  } catch (error) {
    console.error('Error API:', error);
    throw error;
  }
};