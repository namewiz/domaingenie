import * as webllm from '@mlc-ai/web-llm';

interface ExistingModelInfo {
  engine: any;
  source: string;
}

interface AIDomainResult {
  domain: string;
}

interface AIFilters {
  tlds?: string[];
  domainLength?: { min: number; max: number };
  wordCount?: string;
  keywords?: { include: string; exclude: string };
}

/**
 * Smart AI Service that can detect existing WebLLM models or create new ones
 * This ensures we don't download duplicate models while keeping the library self-contained
 */
class SmartAIService {
  private engine: any = null;
  private isInitialized = false;
  private isInitializing = false;
  private modelSource = 'none';
  private modelId = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';


  private detectExistingModel(): ExistingModelInfo | null {
    if (typeof window !== 'undefined') {
      // Only check if our library already created an instance
      if ((window as any).__ai_domain_generator_engine__) {
        console.log('🔄 [ai-domain-generator] Found library\'s previous engine');
        return {
          engine: (window as any).__ai_domain_generator_engine__,
          source: 'library_self'
        };
      }
    }

    console.log('🔍 [ai-domain-generator] No existing library WebLLM instance found - will create new one');
    return null;
  }

  /**
   * Initialize the AI service - either reuse existing model or create new one
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      // Step 1: Try to detect existing model
      const existingModel = this.detectExistingModel();

      if (existingModel) {
        console.log(`🔄 [ai-domain-generator] Reusing existing WebLLM model from ${existingModel.source}`);
        this.engine = existingModel.engine;
        this.modelSource = existingModel.source;
        this.isInitialized = true;
        return;
      }

      // Step 2: No existing model found, create our own
      console.log('🚀 [ai-domain-generator] No existing WebLLM model found, initializing new one...');
      
      this.engine = new webllm.MLCEngine();
      
      // Set up progress tracking
      this.engine.setInitProgressCallback((progress: any) => {
        const percentage = Math.round(progress.progress * 100);
        console.log(`📥 [ai-domain-generator] Downloading AI model: ${percentage}%`);
      });

      // Load the same model as your main app for consistency
      await this.engine.reload(this.modelId);
      
      // Expose for potential reuse by other parts of the application
      if (typeof window !== 'undefined') {
        (window as any).__ai_domain_generator_engine__ = this.engine;
      }
      
      this.modelSource = 'library_created';
      this.isInitialized = true;
      
      console.log('✅ [ai-domain-generator] WebLLM model initialized successfully');
      
    } catch (error) {
      console.error('❌ [ai-domain-generator] Failed to initialize AI model:', error);
      this.isInitializing = false;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Check if the AI service is ready to use
   */
  isReady(): boolean {
    return this.isInitialized && this.engine !== null;
  }

  /**
   * Get current status of the AI service
   */
  getStatus(): { state: string; modelSource: string; isInitializing: boolean } {
    if (this.isInitializing) {
      return { state: 'loading', modelSource: this.modelSource, isInitializing: true };
    }
    if (this.isInitialized) {
      return { state: 'ready', modelSource: this.modelSource, isInitializing: false };
    }
    return { state: 'idle', modelSource: this.modelSource, isInitializing: false };
  }

  /**
   * Build AI prompt with filters
   */
  private buildPrompt(query: string, filters: AIFilters = {}, limit: number = 8): string {
    const promptParts = [
      `Generate EXACTLY ${limit} creative domain name suggestions based on this request: "${query}"`,
      '',
      `IMPORTANT: You must provide exactly ${limit} different domain suggestions, no more and no less.`,
      '',
      'Requirements:'
    ];

    // TLD preferences
    if (filters.tlds && filters.tlds.length > 0) {
      promptParts.push(`- Use only these domain extensions: ${filters.tlds.join(', ')}`);
    } else {
      promptParts.push('- Prefer Nigerian extensions (.ng, .com.ng, .org.ng) but include popular options (.com, .org)');
    }

    // Domain length constraints
    if (filters.domainLength && (filters.domainLength.min !== 2 || filters.domainLength.max !== 20)) {
      promptParts.push(`- Domain length: ${filters.domainLength.min}-${filters.domainLength.max} characters (before extension)`);
    }

    // Word count preferences
    if (filters.wordCount) {
      const wordText = filters.wordCount === '1' ? 'single words' : `${filters.wordCount} words`;
      promptParts.push(`- Use ${wordText} for domain names`);
    }

    // Include keywords
    if (filters.keywords?.include) {
      promptParts.push(`- Must include keywords: ${filters.keywords.include}`);
    }

    // Exclude keywords
    if (filters.keywords?.exclude) {
      promptParts.push(`- Avoid keywords: ${filters.keywords.exclude}`);
    }


    promptParts.push('', 'Consider Nigerian business culture and naming conventions.');
    promptParts.push('');
    promptParts.push('Return ONLY a JSON array with this exact format:');
    promptParts.push('[');
    promptParts.push('  {');
    promptParts.push('    "domain": "example.ng"');
    promptParts.push('  }');
    promptParts.push(']');

    return promptParts.join('\n');
  }

  /**
   * Generate domain suggestions using AI with filter support and retry mechanism
   */
  async generateDomains(
    query: string, 
    options: { 
      limit?: number;
      filters?: AIFilters;
      minResults?: number;
      maxRetries?: number;
    } = {}
  ): Promise<AIDomainResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.engine) {
      throw new Error('AI engine not initialized');
    }

    const limit = options.limit || 8;
    const minResults = options.minResults || 8;
    const maxRetries = options.maxRetries || 3;
    const filters = options.filters || {};
    
    console.log(`🎯 [ai-domain-generator] Starting generation with retry mechanism: target=${limit}, minimum=${minResults}, maxRetries=${maxRetries}`);

    let allDomains: AIDomainResult[] = [];
    let attempt = 0;

    while (attempt < maxRetries && allDomains.length < minResults) {
      attempt++;
      console.log(`🔄 [ai-domain-generator] Attempt ${attempt}/${maxRetries}, current results: ${allDomains.length}/${minResults}`);

      try {
        // Build AI prompt with filters
        const remainingNeeded = Math.max(limit - allDomains.length, minResults - allDomains.length);
        const prompt = this.buildPrompt(query, filters, remainingNeeded);

        const response = await this.engine.chat.completions.create({
          messages: [
            { 
              role: 'system', 
              content: 'You are a domain name generator specialized in Nigerian (.ng) domains. Generate creative, brandable, and culturally relevant domain names based on user requirements. Always respond with valid JSON only. Generate the exact number of domains requested.' 
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.8 + (attempt * 0.1), // Increase randomness on retries
          max_tokens: 1200,
          top_p: 0.9
        });

        const content = response.choices[0]?.message?.content;
        console.log(`📝 [ai-domain-generator] Attempt ${attempt} raw response:`, content);
        
        if (!content) {
          console.warn(`⚠️ [ai-domain-generator] Attempt ${attempt}: No response from AI model`);
          continue;
        }

        // Parse JSON response
        let newDomains: AIDomainResult[] = [];
        try {
          const domains = JSON.parse(content);
          console.log(`📊 [ai-domain-generator] Attempt ${attempt} parsed JSON:`, domains);
          
          if (Array.isArray(domains)) {
            newDomains = domains.filter((item: any) => item && item.domain);
            console.log(`✅ [ai-domain-generator] Attempt ${attempt} valid domains: ${newDomains.length}/${domains.length}`);
          } else {
            console.warn(`⚠️ [ai-domain-generator] Attempt ${attempt}: Response is not an array:`, typeof domains);
          }
        } catch (parseError) {
          console.warn(`❌ [ai-domain-generator] Attempt ${attempt}: JSON parse failed, skipping this attempt`);
          continue;
        }

        // Remove duplicates and add to results
        const uniqueNewDomains = newDomains.filter(newDomain => 
          !allDomains.some(existing => existing.domain === newDomain.domain)
        );
        
        allDomains = [...allDomains, ...uniqueNewDomains];
        console.log(`📈 [ai-domain-generator] After attempt ${attempt}: ${allDomains.length} total domains (added ${uniqueNewDomains.length} unique)`);

      } catch (error) {
        console.error(`❌ [ai-domain-generator] Attempt ${attempt} failed:`, error);
        // Continue to next attempt unless it's the last one
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }

    if (allDomains.length < minResults) {
      console.warn(`⚠️ [ai-domain-generator] Only got ${allDomains.length}/${minResults} minimum domains after ${maxRetries} attempts`);
    } else {
      console.log(`🎉 [ai-domain-generator] Successfully generated ${allDomains.length} domains (target: ${limit}, minimum: ${minResults})`);
    }

    return allDomains.slice(0, limit); // Return up to the requested limit
  }
}

// Export singleton instance
export const smartAIService = new SmartAIService();

// Also export the class for backward compatibility
export { SmartAIService };