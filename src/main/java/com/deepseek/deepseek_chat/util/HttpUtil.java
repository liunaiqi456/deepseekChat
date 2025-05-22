package com.deepseek.deepseek_chat.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLConnection;
import java.util.Map;

/**
 * Http请求工具类
 */
public class HttpUtil {
	private static final Logger logger = LoggerFactory.getLogger(HttpUtil.class);

	private HttpUtil() {

	}

	/**
	 * 发送post请求
	 * 
	 * @param requestUrl
	 * @param headers
	 * @param body
	 * @return
	 */
	public static String doPost(String requestUrl, Map<String, String> headers, String body) {
		HttpURLConnection conn = null;
		BufferedReader reader = null;
		try {
			URL url = new URI(requestUrl).toURL();
			conn = (HttpURLConnection) url.openConnection();
			conn.setRequestMethod("POST");
			conn.setDoOutput(true);
			conn.setDoInput(true);
			conn.setUseCaches(false);
			
			// 设置请求头
			if (headers != null) {
				for (Map.Entry<String, String> entry : headers.entrySet()) {
					conn.setRequestProperty(entry.getKey(), entry.getValue());
				}
			}
			
			// 发送请求体
			try (DataOutputStream out = new DataOutputStream(conn.getOutputStream())) {
				out.write(body.getBytes("UTF-8"));
				out.flush();
			}
			
			// 获取响应
			StringBuilder response = new StringBuilder();
			reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
			String line;
			while ((line = reader.readLine()) != null) {
				response.append(line);
			}
			
			return response.toString();
		} catch (Exception e) {
			logger.error("HTTP请求失败: {}", e.getMessage(), e);
			throw new RuntimeException("HTTP请求失败: " + e.getMessage());
		} finally {
			if (reader != null) {
				try {
					reader.close();
				} catch (Exception e) {
					logger.warn("关闭reader失败", e);
				}
			}
			if (conn != null) {
				conn.disconnect();
			}
		}
	}

	/**
	 * 发送get请求
	 * 
	 * @param url
	 * @param header
	 * @return
	 */
	public static String doGet(String url, Map<String, String> header) {
		String result = "";
		BufferedReader in = null;
		try {
			// 设置 url
			URL realUrl = new URI(url).toURL();
			URLConnection connection = realUrl.openConnection();
			// 设置 header
			for (String key : header.keySet()) {
				connection.setRequestProperty(key, header.get(key));
			}
			// 设置请求 body
			in = new BufferedReader(new InputStreamReader(connection.getInputStream()));
			String line;
			while ((line = in.readLine()) != null) {
				result += line;
			}
		} catch (Exception e) {
			return null;
		}
		return result;
	}
}
