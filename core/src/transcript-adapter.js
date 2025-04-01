/**
 * Transcript Adapter for Vexa Bot
 * 
 * This module extends the Vexa Bot to send transcriptions to our service.
 * It should be imported in the appropriate place in the bot code.
 */
const axios = require('axios');

class TranscriptionAdapter {
  constructor(config) {
    this.config = config;
    this.transcriptionEndpoint = config.transcriptionEndpoint || 'http://transcription-service:8080/transcription';
    this.userId = config.userId || 'unknown';
    this.meetingId = config.meetingId || 'unknown';
    this.speakersMap = new Map(); // Map to track speaker IDs
    this.nextSpeakerId = 1;
    
    console.log(`Transcription adapter initialized for user ${this.userId}, meeting ${this.meetingId}`);
    console.log(`Transcription endpoint: ${this.transcriptionEndpoint}`);
  }

  /**
   * Process and send transcription to our service
   * @param {string} text - The transcribed text
   * @param {string} speakerName - The name of the speaker (if available)
   */
  async processTranscription(text, speakerName = null) {
    if (!text || text.trim() === '') {
      return;
    }
    
    // Determine speaker ID
    let speaker = speakerName || 'Unknown Speaker';
    if (!this.speakersMap.has(speaker)) {
      this.speakersMap.set(speaker, `Speaker-${this.nextSpeakerId++}`);
    }
    
    const speakerId = this.speakersMap.get(speaker);
    
    // Prepare transcription data
    const transcriptionData = {
      meeting_id: this.meetingId,
      user_id: this.userId,
      content: text.trim(),
      speaker: speakerId,
      confidence: 90 // Default confidence level
    };
    
    console.log(`Sending transcription: [${speakerId}] ${text.trim()}`);
    
    try {
      // Send to transcription service
      const response = await axios.post(this.transcriptionEndpoint, transcriptionData);
      console.log(`Transcription sent successfully: ${response.status}`);
    } catch (error) {
      console.error(`Failed to send transcription: ${error.message}`);
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
    }
  }
}

module.exports = TranscriptionAdapter; 