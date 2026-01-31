export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export class ResponseFormatter {
  /**
   * Format success response
   */
  static success<T>(
    data: T,
    message?: string
  ): ApiResponse<T> {
    const response: ApiResponse<T> = {
      success: true,
      data,
    };

    if (message) {
      response.message = message;
    }

    return response;
  }

  /**
   * Format success response with pagination
   */
  static successWithPagination<T>(
    data: T,
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    },
    message?: string
  ): ApiResponse<T> {
    const response: ApiResponse<T> = {
      success: true,
      data,
      pagination,
    };

    if (message) {
      response.message = message;
    }

    return response;
  }

  /**
   * Format error response
   */
  static error(
    error: string | Error
  ): ApiResponse {
    const response: ApiResponse = {
      success: false,
      error: typeof error === 'string' ? error : error.message,
    };

    return response;
  }
}

export default ResponseFormatter;
